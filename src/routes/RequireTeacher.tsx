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
 * Used as a layout route, so it wraps its children via <Outlet />.
 */
export function RequireTeacher() {
  const { status, role } = useAuth();
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

  return <Outlet />;
}
