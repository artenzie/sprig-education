import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { AuthPending } from "./RequireAuth";

/**
 * The gate in front of /host.
 *
 * The same caveat as RequireTeacher, and it needs saying louder here because
 * of what sits behind this route: THIS IS A ROUTING CONVENIENCE, NOT A
 * SECURITY BOUNDARY. `is_host` arrives in the browser as an ordinary field on
 * an ordinary object, and anybody willing to open devtools can flip it and
 * walk straight past this component.
 *
 * What they would find is an empty page. Every read the host dashboard makes
 * is filtered by an RLS policy whose predicate is `public.is_host()`, which
 * reads the flag out of the DATABASE against an id taken from a JWT Supabase
 * signed — not out of anything the browser sent. A non-host who forces their
 * way onto this route gets zero students, zero teachers, zero check-ins and an
 * empty inbox, because the six policies in
 * supabase/migrations/20260818010000_host_role.sql all evaluate to false for
 * them. Deleting this file would make the app confusing, not insecure.
 *
 * Two different redirects, because two different people end up here by
 * accident and neither is helped by being told they lack a flag:
 *
 *   - A teacher who typed the URL, or kept a bookmark from a session where
 *     they were a host. /teacher is their real dashboard.
 *   - A student, almost always by typing the URL. /dashboard is theirs.
 *
 * Used as a layout route, so it wraps its children via <Outlet />.
 */
export function RequireHost() {
  const { status, role, teacher } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <AuthPending />;
  }

  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role !== "teacher") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!teacher?.is_host) {
    return <Navigate to="/teacher" replace />;
  }

  return <Outlet />;
}
