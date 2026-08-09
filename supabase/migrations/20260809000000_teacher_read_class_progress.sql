-- Sprig: let a teacher see their class's progress, not just their roster.
--
-- 20260727000000_teacher_accounts.sql drew this boundary on purpose and said
-- so explicitly: a teacher could see that a student exists, their nickname,
-- and whether they still owe a PIN change -- and nothing about an answer,
-- score or mood. "Showing a teacher their class's progress is a separate
-- piece of work, and it needs its own thinking about what the teacher of a
-- deliberately anonymous student ought to be able to see."
--
-- This is that piece, and it stays narrow on purpose: `progress` only, not
-- `test_attempts`. A row in `progress` says "this student finished this
-- subtopic" -- no score, no answer content, nothing that could read as
-- surveillance of an anonymous student. Scores stay off-limits until that
-- gets its own thinking too.
--
-- The shape is identical to "Teachers read their own students" in
-- 20260727000000: a second, OR'd SELECT policy. Multiple policies for the
-- same command are OR'd together, so this widens nothing for students -- a
-- student's auth.uid() is never any row's teacher_id, so they still see
-- exactly their own rows. A teacher's auth.uid() is never any row's
-- student_id, so the *first* policy (Students read own progress) never
-- matches them; this one is the only way in, and it only ever matches rows
-- belonging to their own class.
--
-- No new grant needed. `grant select, insert, update on progress to
-- authenticated` already exists from 20260725010000_student_rls_policies.sql
-- -- this file only adds a policy, which decides WHICH ROWS, not a grant,
-- which decides whether the table is reachable at all.
drop policy if exists "Teachers read their students' progress" on progress;
create policy "Teachers read their students' progress" on progress
  for select to authenticated
  using (
    exists (
      select 1
        from students s
       where s.id = progress.student_id
         and s.teacher_id = (select auth.uid())
    )
  );

-- Note what is still NOT here: no teacher policy on test_attempts,
-- daily_checkins or weekly_checkins. Those stay exactly as undecided as
-- 20260727000000 left them.
