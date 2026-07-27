import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { MAX_LOGIN_ATTEMPTS, nicknameToEmail, nicknameToSlug } from "@/lib/studentAuth";
import { AuthContext } from "./auth";
import type { AuthStatus, Role, SignInResult, Student, Teacher } from "./auth";

const STUDENT_COLUMNS = "id, nickname, current_tier, must_change_pin";
const TEACHER_COLUMNS = "id, email, school_name";

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
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  // One flag for both lookups: they're fired together and there is no useful
  // in-between state where we know one and not the other.
  const [profilesLoaded, setProfilesLoaded] = useState(false);

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

  /**
   * Who is this session?
   *
   * Note `.maybeSingle()` rather than `.single()`. Every signed-in user is a
   * student OR a teacher, so exactly one of these two lookups is always
   * expected to come back empty — and `.single()` treats "no row" as an error,
   * which would mean every teacher login logged a spurious failure to the
   * console and every student login logged another. `.maybeSingle()` returns
   * null for "no row" and reserves `error` for things that actually went
   * wrong.
   *
   * There is no filter on either query, and there doesn't need to be: RLS
   * returns your own row and nothing else. `.eq("id", id)` would be a second,
   * weaker copy of a rule the database already enforces.
   */
  const loadStudent = useCallback(async (id: string): Promise<Student | null> => {
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Could not load the student profile", error);
      return null;
    }
    return data as Student | null;
  }, []);

  const loadTeacher = useCallback(async (id: string): Promise<Teacher | null> => {
    const { data, error } = await supabase
      .from("teachers")
      .select(TEACHER_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Could not load the teacher profile", error);
      return null;
    }
    return data as Teacher | null;
  }, []);

  // Keyed on the user id rather than the session object: the session is
  // replaced wholesale on every token refresh (hourly), and there's no reason
  // to re-fetch the profile each time the token rotates.
  //
  // Both lookups go out together rather than one-then-the-other. Sequentially
  // it would be a round trip slower for whichever role lost the coin toss, and
  // the losing role would be teachers — who would wait for a students query
  // that was always going to come back empty.
  useEffect(() => {
    if (!userId) {
      setStudent(null);
      setTeacher(null);
      setProfilesLoaded(true);
      return;
    }

    let cancelled = false;
    setProfilesLoaded(false);

    Promise.all([loadStudent(userId), loadTeacher(userId)]).then(
      ([nextStudent, nextTeacher]) => {
        if (cancelled) return;
        setStudent(nextStudent);
        setTeacher(nextTeacher);
        setProfilesLoaded(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [userId, loadStudent, loadTeacher]);

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

  /**
   * Teacher sign-in — a real email, a real password, and nothing else.
   *
   * Deliberately none of the lockout dance above. That exists because student
   * nicknames are guessable: the word lists are in scripts/create-students.ts,
   * in this repo, so "Curious Squirrel" is a name an attacker can arrive at
   * without ever seeing it. A teacher's email is not in a word list. What
   * covers this form is Supabase's own per-IP rate limit, which is the same
   * backstop the student lockout ultimately leans on anyway.
   *
   * The error message doesn't say which half was wrong, for the same reason
   * the student one doesn't: a form that distinguishes "no such account" from
   * "wrong password" is a form that will tell you which teachers exist.
   */
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!email.trim()) {
        return { ok: false, message: "Enter your email address." };
      }
      if (!password) {
        return { ok: false, message: "Enter your password." };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { ok: false, message: "Those details don't match an account." };
      }
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // No need to clear state by hand — onAuthStateChange fires with a null
    // session, and the effect above clears both profiles in response.
  }, []);

  const status: AuthStatus = !sessionLoaded
    ? "loading"
    : !userId
      ? "anon"
      : !profilesLoaded
        ? "loading"
        : "authed";

  // Derived, never stored. The database decides which table has a row for this
  // user; the browser only reports what came back. Anything a student could
  // set for themselves — a flag in localStorage, a field on the session —
  // would be a role they could grant themselves.
  const role: Role = student ? "student" : teacher ? "teacher" : null;

  const value = useMemo(
    () => ({
      status,
      session,
      student,
      teacher,
      role,
      signInWithNickname,
      signInWithEmail,
      signOut,
      refreshStudent,
    }),
    [
      status,
      session,
      student,
      teacher,
      role,
      signInWithNickname,
      signInWithEmail,
      signOut,
      refreshStudent,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * This used to end at "Try again in N minutes", with a comment explaining that
 * it deliberately did NOT say "ask your teacher" — because at the time nothing
 * could lift a lock early. The service-role key has no grant on login_attempts
 * (20260725030000_service_role_grants.sql withholds it on purpose), and
 * clear_login_attempts() needs the student's own session, which is exactly what
 * they cannot get while locked. Sending a student to fetch a teacher who could
 * not help would have wasted a lesson.
 *
 * A teacher can now clear it, in one click, from /teacher — see
 * public.teacher_unlock_student() in
 * supabase/migrations/20260727010000_teacher_tools.sql. So the sentence comes
 * back, and the wait becomes the fallback rather than the only option.
 */
function lockoutMessage(secondsLeft: number): string {
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  return (
    `Too many wrong PINs. Ask your teacher to unlock your account, ` +
    `or try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
  );
}
