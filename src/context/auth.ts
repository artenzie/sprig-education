import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

/**
 * The shape of Sprig's auth state, and the hook for reading it.
 *
 * Split out from AuthProvider.tsx deliberately: a module that exports both a
 * component and other values breaks React Fast Refresh, so the provider lives
 * on its own and everything non-component lives here.
 */

/**
 * The signed-in student, as the app needs them.
 *
 * Note this is the row from `students`, not the Supabase auth user. The auth
 * user holds the credentials; this holds who they are in Sprig. They share an
 * id — that shared id is the pivot the whole auth design turns on, and what
 * makes `auth.uid() = student_id` a sufficient ownership check in every RLS
 * policy.
 */
export type Student = {
  id: string;
  nickname: string;
  current_tier: number;
  must_change_pin: boolean;
  // Independently nullable, and deliberately typed as plain strings rather
  // than the union in leafAvatars.tsx: these arrive from the database, and
  // typing a value as narrower than it can actually be is how a renamed
  // avatar id turns into a crash instead of a fallback. The validators there
  // narrow them at the point of use.
  avatar_shape: string | null;
  avatar_colour: string | null;
};

/**
 * The signed-in teacher — the same idea as Student, one table over.
 *
 * teachers.id is also the auth user id (see
 * supabase/migrations/20260727000000_teacher_accounts.sql), for exactly the
 * reason students.id is: it makes `auth.uid() = teacher_id` a sufficient
 * ownership check, which is what every teacher policy and every teacher
 * function in the database relies on.
 *
 * Unlike a student, a teacher has a real email address and it is not a secret
 * from them — there is no synthetic-address bridge here.
 */
export type Teacher = {
  id: string;
  email: string;
  school_name: string | null;
  /**
   * Whether this teacher can see across every class rather than only their
   * own — see supabase/migrations/20260818010000_host_role.sql.
   *
   * Deliberately a flag on the teacher rather than a third value in `Role`.
   * A host IS a teacher: they have a class, they use /teacher, and every
   * teacher rule applies to them unchanged. What they additionally have is
   * one boolean that six RLS policies read. Modelling that as a separate role
   * would have meant teaching RequireAuth, RequireTeacher and the role
   * derivation about a case that behaves identically to `teacher` in all but
   * one respect.
   *
   * As with everything else on this type, it is REPORTED by the browser, not
   * decided by it. The value arrives from a policy-filtered read of the
   * teacher's own row, and setting it in devtools would change what the UI
   * offers to show and nothing whatsoever about what the database returns.
   */
  is_host: boolean;
};

/**
 * Which half of the app a session belongs to.
 *
 * A session is one or the other, decided by which table has a row for
 * auth.uid() — never by anything the browser stores or chooses. `null` means
 * signed in with neither, which shouldn't happen (both creation scripts write
 * the profile row alongside the auth user) but is handled rather than assumed
 * away; see AccountIncomplete in src/routes/RequireAuth.tsx.
 */
export type Role = "student" | "teacher" | null;

/**
 * "loading" matters more than it looks. Restoring a session from localStorage
 * is asynchronous, so on every page load there is a moment where we genuinely
 * do not know whether anyone is signed in. Treating that moment as "signed
 * out" would bounce a logged-in student to /login on every refresh.
 */
export type AuthStatus = "loading" | "authed" | "anon";

export type SignInResult = { ok: true } | { ok: false; message: string };

export type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  student: Student | null;
  teacher: Teacher | null;
  role: Role;
  signInWithNickname: (nickname: string, pin: string) => Promise<SignInResult>;
  signInWithEmail: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshStudent: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return value;
}
