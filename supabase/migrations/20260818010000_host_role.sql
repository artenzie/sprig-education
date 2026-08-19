-- Sprig: a host -- one account that can read across every teacher's class.
--
-- Everything in this schema so far has been scoped to one person's own data.
-- A student sees their own rows (auth.uid() = student_id). A teacher sees
-- their own class (auth.uid() = teacher_id), and since 20260809000000 that
-- class's completions -- and deliberately nothing else, no score, no answer,
-- no mood. This file is the first thing that reads WIDER than that, and it is
-- worth being blunt about what it is: a deliberate widening, for exactly one
-- account, that can see every check-in, every free-text answer and every test
-- score written by roughly ninety 13-year-olds across three schools.
--
-- That is the whole reason it is built the way it is below.
--
-- THE ONE RULE THIS FILE FOLLOWS: every host rule is a NEW, ADDITIONAL policy,
-- and not one existing policy's text is edited.
--
-- Postgres OR's multiple SELECT policies for the same table together. So
-- adding "or the caller is a host" as a SEPARATE policy has a property that
-- writing it INTO the existing policy does not: for a caller who is not a
-- host, the new policy's predicate is false, contributes nothing to the OR,
-- and the rows they see are the rows they saw yesterday. Byte for byte.
--
-- The tempting alternative was to edit each teacher policy from
--
--     using ((select auth.uid()) = teacher_id)
-- to
--     using ((select auth.uid()) = teacher_id or (select public.is_host()))
--
-- which is fewer lines and reads more directly. It was rejected because it
-- puts the teacher rule and the host rule in one expression, where a mistake
-- in the host half silently widens the TEACHER half -- and the teacher half is
-- the one that is currently correct and load-bearing. Kept apart, the worst a
-- bug in this file can do is break the host's own dashboard.
--
-- THE SECOND RULE: no new table-level GRANT to `authenticated`.
--
-- Two separate things gate a table (see 20260727000000's header): the GRANT
-- decides whether the table is reachable at all, the POLICY decides which
-- rows. Every table this file touches ALREADY has `grant select ... to
-- authenticated`, so what is added here changes only which rows -- never
-- whether a table that was previously unreachable becomes reachable. The one
-- table without such a grant is help_messages, and it does not get one; see
-- 20260818020000_host_tools.sql for how the inbox is reached instead.
--
-- Run 20260727000000_teacher_accounts.sql first; this depends on teachers.id
-- being an auth.users id.

-- ---------------------------------------------------------------------------
-- The flag
-- ---------------------------------------------------------------------------
-- `not null default false` is the entire security posture of this column in
-- one line: every teacher that exists, and every teacher created from here on,
-- is a non-host unless somebody deliberately says otherwise.
--
-- And "deliberately" means with the service-role key or the dashboard, because
-- of something already true that this column now leans on heavily: there is no
-- INSERT, UPDATE or DELETE grant on `teachers` for `authenticated` -- only
-- `grant select` (20260727000000). A teacher's session literally cannot write
-- to this table, so it cannot set this flag on itself. That is not a policy
-- that could be misconfigured; it is the absence of a grant, checked before
-- RLS is consulted at all.
alter table teachers add column if not exists is_host boolean not null default false;

-- ---------------------------------------------------------------------------
-- The predicate
-- ---------------------------------------------------------------------------
-- The single place that decides who is a host, so the six policies below --
-- and the three things 20260818020000_host_tools.sql builds on top of them --
-- cannot drift apart from each other later. Same argument as teacher_owns_student()
-- in 20260727010000, and the same shape: it takes NO PARAMETERS. The caller is
-- read from a JWT Supabase signed. There is no p_teacher_id to pass, because
-- offering one would mean trusting the browser to name itself.
--
-- `security definer` is not stylistic here, it is load-bearing, for a reason
-- that only shows up on one of the policies below:
--
--   One of these policies sits on `teachers` ITSELF (the host dashboard counts
--   teachers and schools). A policy on `teachers` whose predicate runs an
--   ordinary subquery against `teachers` is a cycle -- Postgres detects it and
--   throws 42P17, "infinite recursion detected in policy for relation
--   teachers". A security-definer function runs as its owner, which is not
--   subject to RLS, so the subquery inside it does not re-enter the policy.
--
-- Written as `(select public.is_host())` at every call site rather than bare
-- `public.is_host()`. Wrapping it in a subselect lets the planner hoist it
-- into an InitPlan and evaluate it ONCE per query instead of once per row --
-- the same trick, for the same reason, as the `(select auth.uid())` that every
-- policy in this schema already uses.
create or replace function public.is_host()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.teachers t
     where t.id = auth.uid()
       and t.is_host
  )
$$;

-- Unlike the internal guards in 20260727010000, this one MUST be executable by
-- the caller: a policy's predicate runs as the querying role, so a role that
-- cannot execute this function cannot read the table at all. Granting it is
-- safe -- it takes nothing, and reports only on whoever is already signed in.
-- A student calling it gets false.
revoke execute on function public.is_host() from public;
grant execute on function public.is_host() to authenticated;

-- ---------------------------------------------------------------------------
-- What a host can read
-- ---------------------------------------------------------------------------
-- Six policies, all the same shape, all SELECT and only SELECT.
--
-- There is deliberately no host INSERT, UPDATE or DELETE policy anywhere. The
-- host's READ surface is the whole cohort; the host's WRITE surface stays
-- exactly the two security-definer actions a teacher already has (unlock, and
-- reset a PIN), which log every attempt and are capped at 40 an hour. Broad
-- read plus narrow, audited write is a very different risk from broad write.

-- The roster, cohort-wide. Sits alongside "Students read own row" and
-- "Teachers read their own students"; adds a third way in that only a host
-- satisfies.
drop policy if exists "Hosts read all students" on students;
create policy "Hosts read all students" on students
  for select to authenticated
  using ((select public.is_host()));

-- Every teacher, for the school and teacher counts, and to label each student
-- with the class they belong to. THIS is the policy that makes is_host()'s
-- `security definer` mandatory -- see the note on the function above.
drop policy if exists "Hosts read all teachers" on teachers;
create policy "Hosts read all teachers" on teachers
  for select to authenticated
  using ((select public.is_host()));

-- Completions, cohort-wide. Feeds the overall and per-tier completion figures.
drop policy if exists "Hosts read all progress" on progress;
create policy "Hosts read all progress" on progress
  for select to authenticated
  using ((select public.is_host()));

-- Scores and stored answers. Note this crosses a line 20260727000000 and
-- 20260809000000 both explicitly declined to cross for teachers, and it stays
-- uncrossed for them: a teacher still cannot see a single score. Only a host
-- can, and only in aggregate on the page that reads it.
drop policy if exists "Hosts read all test attempts" on test_attempts;
create policy "Hosts read all test attempts" on test_attempts
  for select to authenticated
  using ((select public.is_host()));

-- Mood, and the optional note that goes with it.
drop policy if exists "Hosts read all daily checkins" on daily_checkins;
create policy "Hosts read all daily checkins" on daily_checkins
  for select to authenticated
  using ((select public.is_host()));

-- Confidence, completion, and the two free-text answers.
drop policy if exists "Hosts read all weekly checkins" on weekly_checkins;
create policy "Hosts read all weekly checkins" on weekly_checkins
  for select to authenticated
  using ((select public.is_host()));

-- ---------------------------------------------------------------------------
-- After running this
-- ---------------------------------------------------------------------------
-- 1. Flag the host. Deliberately NOT written into this file -- a migration in
--    the repo is the wrong place for a specific person's email address, and
--    this is a one-off act, not part of the schema:
--
--      update teachers set is_host = true where email = 'you@example.com';
--
--    Check it took, and that it took exactly once:
--
--      select email, is_host from teachers order by is_host desc, email;
--
-- 2. Verify that nothing else moved. `scripts/check-rls.ts` signs in as a
--    host, a non-host teacher and a student for real, through the publishable
--    key, and reports exactly what each of them can see:
--
--      node --env-file=.env scripts/check-rls.ts --baseline rls-baseline.json
--
--    The pass condition for the non-host teacher and the student is not "the
--    numbers look small" -- it is "the numbers are IDENTICAL to the baseline
--    captured before this migration ran". Anything else means the OR'd
--    policies above widened something they should not have.
