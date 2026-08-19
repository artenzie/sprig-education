import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { AuthPending } from "./RequireAuth";

/**
 * The gate in front of /teacher.
 *
 * The same caveat applies here as on RequireAuth, and applies harder: this is
 * a routing convenience, not a security boundary. Anyone can edit their way
 * past a client-side redirect, and a student who did would find an empty page
 * — the roster is filtered by the "Teachers read their own students" policy,
 * and the unlock and reset actions are refused by teacher_owns_student() in
 * the database. Deleting this file would make the app rude, not insecure.
 *
 * That caveat matters more than usual for the host redirect below, so it is
 * worth stating plainly: sending a host away from /teacher REMOVES A PAGE, it
 * does not remove any access. A host's RLS policies still return every
 * student in the pilot wherever `students` is read — that is the whole point
 * of the role. This route now has exactly one occupant, the ordinary teacher
 * it was built for, which makes "your class" true again for everyone who can
 * reach it.
 *
 * Used as a layout route, so it wraps its children via <Outlet />.
 */
export function RequireTeacher() {
  const { status, role, teacher } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <AuthPending />;
  }

  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Signed in as somebody else — almost always a student who typed the URL.
  // Their own dashboard is the useful place to land, and saying "you are not a
  // teacher" would tell them something they already know.
  if (role !== "teacher") {
    return <Navigate to="/dashboard" replace />;
  }

  // A host belongs on /host and nowhere else. /teacher is scoped to "your own
  // class" in its copy and its headings, and a host reading it would be shown
  // the entire pilot under a heading that says otherwise — the two pages tell
  // different stories about the same table, and only one of them can be right
  // for a given account.
  if (teacher?.is_host) {
    return <Navigate to="/host" replace />;
  }

  return <Outlet />;
}
