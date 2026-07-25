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
};

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
  signInWithNickname: (nickname: string, pin: string) => Promise<SignInResult>;
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
