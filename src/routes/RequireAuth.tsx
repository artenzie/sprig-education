import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";

/**
 * The gate in front of every page that shows or touches a student's own data.
 *
 * Worth being clear about what this is and isn't: it is a routing convenience,
 * not a security boundary. Anyone can edit their way past a client-side
 * redirect. The actual protection is the RLS policies in
 * supabase/migrations/20260725010000_student_rls_policies.sql — a request
 * without a valid session simply returns no rows, whatever the browser thinks.
 * This exists so students see a login form instead of an empty dashboard.
 *
 * Used as a layout route, so it wraps its children via <Outlet />.
 */
export function RequireAuth({ allowPinChange = false }: { allowPinChange?: boolean }) {
  const { status, student, teacher } = useAuth();
  const location = useLocation();

  // Restoring a session from localStorage is async. Rendering the redirect
  // during that gap would throw a signed-in student back to /login on every
  // page refresh.
  if (status === "loading") {
    return <AuthPending />;
  }

  if (status === "anon") {
    // `from` lets the login page send them where they were actually going.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A teacher who typed a student URL, or followed a stale bookmark. Send them
  // to their own half of the app rather than showing them the "Something's
  // missing" screen below — which is what happened before teacher sessions
  // existed, since a teacher has no `students` row and never will.
  if (!student && teacher) {
    return <Navigate to="/teacher" replace />;
  }

  // Signed in, but no matching row in `students` OR `teachers`. Shouldn't
  // happen — both creation scripts write the profile alongside the auth user,
  // and roll the auth user back if that fails — but it would leave someone
  // stuck on a blank screen with no explanation, so say something instead.
  if (!student) {
    return <AccountIncomplete />;
  }

  // The forced first-time PIN change. /set-pin sets allowPinChange so it can
  // sit behind this same gate without redirecting to itself forever.
  if (!allowPinChange && student.must_change_pin) {
    return <Navigate to="/set-pin" replace />;
  }

  return <Outlet />;
}

/** Exported so RequireTeacher shows the identical gap-filler. */
export function AuthPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-forest sprig-glow" />
        <span>Finding your sprig</span>
      </div>
    </div>
  );
}

function AccountIncomplete() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-8">
      <div className="max-w-md text-center">
        <h1 className="font-display text-[32px] font-normal leading-[1.1] tracking-[-0.03em]">
          Something's missing.
        </h1>
        <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground">
          You're signed in, but we can't find your profile. Ask your teacher to
          check your account, then try signing in again.
        </p>
        <button
          onClick={() => void signOut()}
          className="mt-8 rounded-full bg-forest px-6 py-2.5 text-[13.5px] text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
