-- Sprig: base table grants for service_role.
--
-- Found by running scripts/create-students.ts, which failed on its very first
-- query with:
--
--   permission denied for table students
--
-- ...while holding the service-role key. Which looks impossible, because
-- service_role bypasses row-level security.
--
-- It isn't, and this is the SAME lesson as 20260724020000_grant_public_content_read.sql,
-- one layer further down. Bypassing RLS and being allowed to touch the table
-- are two different checks:
--
--   1. Does this role hold a table-level GRANT?   <- checked FIRST, for everyone
--   2. Which rows do the RLS policies allow?      <- service_role skips this one
--
-- service_role skips step 2 and always did. It was failing step 1. Supabase
-- normally sets up default privileges so new tables in `public` are granted to
-- anon/authenticated/service_role automatically, but these tables were created
-- without that in place -- which is exactly why the content tables needed an
-- explicit grant back in July, and why 20260725010000 had to grant to
-- `authenticated` by hand.
--
-- So: grant the roles their base access explicitly rather than relying on a
-- default that demonstrably isn't applying to this project's tables.

-- Student-owned tables. service_role is the key used by local admin tooling
-- (scripts/create-students.ts, and whatever teacher tooling comes later), so
-- it needs full access. This grants nothing to the browser: `anon` and
-- `authenticated` are untouched here, and their access is still exactly what
-- 20260725010000 gave them -- select on students, select/insert/update on the
-- rest, all filtered by RLS.
grant all on students, progress, test_attempts, daily_checkins, weekly_checkins to service_role;

-- Curriculum tables. Not needed by anything today -- the July 24 migration
-- already granted anon/authenticated the read access the app uses -- but any
-- future script that seeds or edits content with the service-role key would
-- hit the identical wall, and would be just as confusing the second time.
grant all on topics, subtopics, slides, questions to service_role;

-- `teachers` is deliberately left out, along with `login_attempts`.
--
-- teachers: still entirely out of scope, still unreachable by every role.
-- login_attempts: reached only through the security-definer functions in
-- 20260725020000, which run as the table's owner. Granting service_role
-- access to it would add nothing except a second way in.
