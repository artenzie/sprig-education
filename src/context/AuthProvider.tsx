import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { MAX_LOGIN_ATTEMPTS, nicknameToEmail, nicknameToSlug } from "@/lib/studentAuth";
import { AuthContext } from "./auth";
import type { AuthStatus, SignInResult, Student } from "./auth";

const STUDENT_COLUMNS = "id, nickname, current_tier, must_change_pin";

/** What the lockout functions in the database return. */
type LockoutPayload = {
  locked: boolean;
  locked_until: string | null;
  seconds_left: number;
  attempts_left: number;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [studentLoaded, setStudentLoaded] = useState(false);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let cancelled = false;

    // The session lives in localStorage; reading it back is async.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    // This callback must stay synchronous.
    //
    // supabase-js holds an internal lock while it runs, so awaiting another
    // supabase call inside it deadlocks the client — the app simply hangs,
    // with no error anywhere to explain why. So all we do here is drop the
    // session into state; loading the students row happens in the effect
    // below, outside the lock.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadStudent = useCallback(async (id: string): Promise<Student | null> => {
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_COLUMNS)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Could not load the student profile", error);
      return null;
    }
    return data as Student;
  }, []);

  // Keyed on the user id rather than the session object: the session is
  // replaced wholesale on every token refresh (hourly), and there's no reason
  // to re-fetch the profile each time the token rotates.
  useEffect(() => {
    if (!userId) {
      setStudent(null);
      setStudentLoaded(true);
      return;
    }

    let cancelled = false;
    setStudentLoaded(false);

    loadStudent(userId).then((next) => {
      if (cancelled) return;
      setStudent(next);
      setStudentLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, loadStudent]);

  const refreshStudent = useCallback(async () => {
    if (!userId) return;
    const next = await loadStudent(userId);
    if (next) setStudent(next);
  }, [userId, loadStudent]);

  /**
   * The whole login sequence, in the order it has to happen.
   *
   * The error messages are deliberately vague about *which* half was wrong.
   * Saying "no such nickname" would turn this form into a way to discover which
   * nicknames exist, and a nickname is the only identifier a student has.
   */
  const signInWithNickname = useCallback(
    async (nickname: string, pin: string): Promise<SignInResult> => {
      if (!nicknameToSlug(nickname)) {
        return { ok: false, message: "Enter the nickname your teacher gave you." };
      }
      if (!pin) {
        return { ok: false, message: "Enter your PIN." };
      }

      // 1. Locked out? Find out before touching the auth endpoint, so a locked
      //    student doesn't spend their whole class's shared per-IP rate limit
      //    on attempts that were never going to succeed.
      const { data: before, error: beforeError } = await supabase.rpc("login_lockout_status", {
        p_nickname: nickname,
      });
      if (beforeError) {
        console.error("Lockout check failed", beforeError);
        return { ok: false, message: "Something went wrong signing in. Try again in a moment." };
      }
      const lockedBefore = before as LockoutPayload | null;
      if (lockedBefore?.locked) {
        return { ok: false, message: lockoutMessage(lockedBefore.seconds_left) };
      }

      // 2. The actual sign-in. The PIN is the password, verbatim.
      const { error } = await supabase.auth.signInWithPassword({
        email: nicknameToEmail(nickname),
        password: pin,
      });

      // 3. Wrong: count it, and say how many tries are left.
      if (error) {
        const { data: after } = await supabase.rpc("record_failed_login", {
          p_nickname: nickname,
        });
        const lockedAfter = after as LockoutPayload | null;

        if (lockedAfter?.locked) {
          return { ok: false, message: lockoutMessage(lockedAfter.seconds_left) };
        }

        const left = lockedAfter?.attempts_left ?? MAX_LOGIN_ATTEMPTS;
        return {
          ok: false,
          message: `That nickname and PIN don't match. ${left} ${left === 1 ? "try" : "tries"} left.`,
        };
      }

      // 4. Right: wipe the counter. This has to come after sign-in — the
      //    function identifies the student from their session, which is exactly
      //    why it can't be used to clear anyone else's count.
      const { error: clearError } = await supabase.rpc("clear_login_attempts");
      if (clearError) {
        // Not worth failing a good login over; the row expires on its own.
        console.error("Could not clear the login attempt counter", clearError);
      }

      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // No need to clear state by hand — onAuthStateChange fires with a null
    // session, and the effect above clears the student row in response.
  }, []);

  const status: AuthStatus = !sessionLoaded
    ? "loading"
    : !userId
      ? "anon"
      : !studentLoaded
        ? "loading"
        : "authed";

  const value = useMemo(
    () => ({ status, session, student, signInWithNickname, signOut, refreshStudent }),
    [status, session, student, signInWithNickname, signOut, refreshStudent],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Deliberately does NOT say "ask your teacher". Nothing can currently lift a
 * lock early: the service-role key has no grant on login_attempts (see
 * 20260725030000_service_role_grants.sql, which withholds it on purpose), and
 * clear_login_attempts() needs the student's own session -- which is exactly
 * what they cannot get while locked. So waiting is genuinely the only remedy,
 * and telling a student to fetch a teacher who can't help would waste a
 * lesson. Restore that sentence once teacher tooling can actually clear a lock.
 */
function lockoutMessage(secondsLeft: number): string {
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  return `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
