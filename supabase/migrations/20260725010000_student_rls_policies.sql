-- Sprig: row-level security for the student-owned tables.
--
-- Two separate things are needed before a logged-in student can touch a
-- table, and missing either one produces a failure that looks nothing like a
-- permissions problem:
--
--   1. A table-level GRANT. Postgres checks this FIRST, before RLS is even
--      considered. Without it you get error 42501, "permission denied for
--      table X" -- a hard error, not an empty result. This project already
--      learned that the hard way; see the comment in
--      20260724020000_grant_public_content_read.sql.
--   2. An RLS policy. The grant says "this role may read this table at all";
--      the policy says WHICH ROWS.
--
-- The policy is the same shape every time: auth.uid() = student_id.
-- auth.uid() reads the user id out of the JWT the browser sent with the
-- request. That token is signed by Supabase, so a student cannot forge it to
-- claim someone else's id -- which is exactly why the previous migration made
-- students.id the auth user id. The ownership check needs nothing else.
--
-- Note it is written `(select auth.uid())` rather than bare `auth.uid()`.
-- Both are correct, but wrapping it in a subquery lets Postgres evaluate the
-- call once per statement instead of once per row -- Supabase's documented
-- RLS performance idiom, and worth having from the start.
--
-- Every `create policy` is preceded by `drop policy if exists`, because
-- `create policy` has no `if not exists` form and these migrations are pasted
-- into the SQL Editor by hand. Re-running this file is now harmless.

-- ---------------------------------------------------------------------------
-- students -- read-only, and only your own row.
-- ---------------------------------------------------------------------------
-- Deliberately no insert/update/delete grant. Accounts are created out of
-- band with the service-role key (scripts/create-students.ts), and the one
-- column a student is allowed to change, must_change_pin, is changed by the
-- security-definer function at the bottom of this file. So there is no path
-- from the browser to a write on this table at all.
grant select on students to authenticated;

drop policy if exists "Students read own row" on students;
create policy "Students read own row" on students
  for select to authenticated
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- progress -- one row per student per subtopic.
-- ---------------------------------------------------------------------------
-- select/insert/update but NOT delete, here and on every table below: a
-- student should be able to record and revise their own work, but not erase
-- their history. Nothing in the app needs delete, so it isn't granted.
--
-- Both `using` and `with check` are needed on update. `using` decides which
-- rows you may target; `with check` validates the row you're leaving behind.
-- With only `using`, a student could take a row they own and rewrite its
-- student_id to someone else's -- handing the row away.
grant select, insert, update on progress to authenticated;

drop policy if exists "Students read own progress" on progress;
create policy "Students read own progress" on progress
  for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students insert own progress" on progress;
create policy "Students insert own progress" on progress
  for insert to authenticated
  with check ((select auth.uid()) = student_id);

drop policy if exists "Students update own progress" on progress;
create policy "Students update own progress" on progress
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- ---------------------------------------------------------------------------
-- test_attempts -- baseline, progress checks and growth checks.
-- ---------------------------------------------------------------------------
grant select, insert, update on test_attempts to authenticated;

drop policy if exists "Students read own test attempts" on test_attempts;
create policy "Students read own test attempts" on test_attempts
  for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students insert own test attempts" on test_attempts;
create policy "Students insert own test attempts" on test_attempts
  for insert to authenticated
  with check ((select auth.uid()) = student_id);

drop policy if exists "Students update own test attempts" on test_attempts;
create policy "Students update own test attempts" on test_attempts
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- ---------------------------------------------------------------------------
-- daily_checkins -- one mood row per student per day.
-- ---------------------------------------------------------------------------
grant select, insert, update on daily_checkins to authenticated;

drop policy if exists "Students read own daily checkins" on daily_checkins;
create policy "Students read own daily checkins" on daily_checkins
  for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students insert own daily checkins" on daily_checkins;
create policy "Students insert own daily checkins" on daily_checkins
  for insert to authenticated
  with check ((select auth.uid()) = student_id);

drop policy if exists "Students update own daily checkins" on daily_checkins;
create policy "Students update own daily checkins" on daily_checkins
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- ---------------------------------------------------------------------------
-- weekly_checkins -- confidence and reflection, one row per student per week.
-- ---------------------------------------------------------------------------
grant select, insert, update on weekly_checkins to authenticated;

drop policy if exists "Students read own weekly checkins" on weekly_checkins;
create policy "Students read own weekly checkins" on weekly_checkins
  for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists "Students insert own weekly checkins" on weekly_checkins;
create policy "Students insert own weekly checkins" on weekly_checkins
  for insert to authenticated
  with check ((select auth.uid()) = student_id);

drop policy if exists "Students update own weekly checkins" on weekly_checkins;
create policy "Students update own weekly checkins" on weekly_checkins
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- `teachers` is intentionally untouched: RLS on, zero policies, no grant, so
-- it stays unreachable from any client. Teacher accounts are a separate piece
-- of work.

-- ---------------------------------------------------------------------------
-- Clearing the must-change-PIN flag.
-- ---------------------------------------------------------------------------
-- Students have no update grant on their own row (above), so this function is
-- the only way the flag can move. `security definer` means it runs with the
-- privileges of its owner rather than the caller's, which is what lets it
-- perform an update the caller could never perform directly.
--
-- `set search_path = ''` is the standard hardening for a security-definer
-- function: without it the caller controls where unqualified names like
-- `students` resolve, and could point them at a table of their own. With an
-- empty search_path nothing resolves implicitly, so every name below is
-- schema-qualified.
--
-- The caller is whoever holds the JWT, so auth.uid() identifies them and they
-- can only ever clear their own flag. The app calls this immediately after
-- supabase.auth.updateUser() succeeds -- see src/pages/SetPin.tsx.
create or replace function public.complete_pin_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'complete_pin_change() requires a signed-in student';
  end if;

  update public.students
     set must_change_pin = false
   where id = auth.uid();
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, so the
-- revoke has to come first -- granting to `authenticated` alone would not
-- take anything away.
revoke execute on function public.complete_pin_change() from public;
grant execute on function public.complete_pin_change() to authenticated;
