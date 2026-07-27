-- Sprig: move teacher login onto Supabase's native auth.
--
-- This is the same surgery 20260725000000_auth_students_table.sql performed on
-- `students`, for the same reason, and it is worth reading that file alongside
-- this one -- the shape is deliberately identical.
--
-- `teachers` has sat untouched since the initial schema on 21 July, carrying:
--
--   id       uuid primary key default gen_random_uuid(),
--   email    text unique not null,
--   password text not null,   -- "hashed, never plain text"
--   school_name text
--
-- ...which is the sketch of a hand-rolled credential store: a password column
-- we would have had to hash, salt, compare and rotate ourselves. Students
-- stopped doing that on 25 July and teachers stop doing it here. A teacher
-- becomes a real row in auth.users, and their password becomes that user's
-- password -- bcrypt-hashed by Supabase, unreadable by us from that point on.
--
-- The keystone, exactly as it was for students, is the `drop default` plus the
-- foreign key: teachers.id STOPS generating its own uuid and instead *is* the
-- auth user's id. That single change is what makes `auth.uid() = teacher_id` a
-- sufficient ownership check -- no join, no lookup table, no trust placed in
-- anything the browser sent.
--
-- Unlike students, there is no synthetic email address here. A teacher has a
-- real school email and types it as-is; the whole nickname-to-address bridge in
-- src/lib/studentAuth.ts exists only because students deliberately have no
-- email, and none of it applies.
--
-- PRECONDITION: `select count(*) from teachers;` must return 0. Nothing has
-- ever written to this table -- it has had RLS on with zero policies and zero
-- grants to any role since the day it was created, including service_role --
-- so it should be empty. If it isn't, stop and deal with those rows first: the
-- rewiring below cannot invent auth users for teachers that already exist.

-- ---------------------------------------------------------------------------
-- The table itself
-- ---------------------------------------------------------------------------

-- The password now lives in auth.users.encrypted_password. A second copy here
-- would be a liability, not a feature.
alter table teachers drop column if exists password;

-- id must now be supplied by the caller, and must be a real auth user.
alter table teachers alter column id drop default;

-- Wrapped in a guard because `add constraint` has no `if not exists` form, and
-- these migrations are applied by pasting them into the SQL Editor by hand.
-- Everything else in this file is naturally re-runnable; this makes the whole
-- file so.
--
-- `on delete cascade`: deleting the auth user cleans up the teacher row too,
-- rather than leaving a profile behind that nobody can ever sign in to.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'teachers_id_fkey'
       and conrelid = 'public.teachers'::regclass
  ) then
    alter table teachers
      add constraint teachers_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- The link to students
-- ---------------------------------------------------------------------------
-- students.teacher_id has existed since the initial schema and is already a
-- foreign key. It just has two problems.
--
-- First, its delete behaviour. The original `references teachers(id)` has no
-- ON DELETE clause, which means NO ACTION: deleting a teacher who still has
-- students would simply be refused. That is the wrong failure. Losing a
-- teacher account should not be able to take a class's accounts with it, and
-- it should not be blocked either -- `set null` leaves the students intact and
-- unassigned, which is recoverable with a single update. This matters more
-- than it sounds, because teachers.id now cascades from auth.users: deleting a
-- teacher's auth user would otherwise fail with a foreign key error pointing
-- at a table nobody was thinking about.
alter table students drop constraint if exists students_teacher_id_fkey;
alter table students
  add constraint students_teacher_id_fkey
  foreign key (teacher_id) references teachers(id) on delete set null;

-- Second, there was never an index on it. Every teacher-facing read filters on
-- this column, and the RLS policy below applies that filter to every row of
-- `students` on every query.
create index if not exists students_teacher_id_idx on students (teacher_id);

-- ---------------------------------------------------------------------------
-- Grants and policies
-- ---------------------------------------------------------------------------
-- Two separate things are needed before a signed-in user can touch a table,
-- and missing either one produces a failure that looks nothing like a
-- permissions problem:
--
--   1. A table-level GRANT, checked FIRST, before RLS is considered at all.
--      Without it you get 42501, "permission denied for table X" -- a hard
--      error, not an empty result.
--   2. An RLS policy, which decides WHICH ROWS.
--
-- This project has now been caught by (1) twice -- see the headers of
-- 20260724020000_grant_public_content_read.sql and
-- 20260725030000_service_role_grants.sql. `teachers` has never been granted to
-- anybody, so it is primed to do it a third time.

-- The browser: read your own row, nothing else. This one policy is what lets
-- the app tell a teacher session apart from a student session -- src/context/
-- AuthProvider.tsx looks for a row here and a row in `students`, and whichever
-- comes back decides which half of the app you get.
--
-- Deliberately no insert/update/delete. Teacher accounts are created out of
-- band with the service-role key (scripts/create-teacher.ts), so there is no
-- path from the browser to a write on this table at all -- the same stance
-- 20260725010000 takes on `students`.
grant select on teachers to authenticated;

drop policy if exists "Teachers read own row" on teachers;
create policy "Teachers read own row" on teachers
  for select to authenticated
  using ((select auth.uid()) = id);

-- The local admin tooling. 20260725030000_service_role_grants.sql deliberately
-- withheld this, on the grounds that teachers were "still entirely out of
-- scope, still unreachable by every role". They are in scope now, and without
-- this scripts/create-teacher.ts fails on its first query with the exact
-- "permission denied for table teachers" that migration was written to
-- explain.
grant all on teachers to service_role;

-- ---------------------------------------------------------------------------
-- A teacher's students
-- ---------------------------------------------------------------------------
-- A SECOND select policy on `students`, sitting alongside "Students read own
-- row" from 20260725010000. Multiple policies for the same command are OR'd
-- together, so this widens nothing for students: a student's auth.uid() is
-- never any row's teacher_id, so they still see exactly one row -- their own.
-- A teacher's auth.uid() is never any row's id, so they see exactly their
-- class and never a stray student of someone else's.
--
-- No grant is needed here; `grant select on students to authenticated` already
-- exists from 20260725010000.
--
-- Why this is enough on its own: auth.uid() is read out of a JWT that Supabase
-- signed, so it cannot be forged, and teacher_id is a column only the
-- service-role script ever writes. Nothing the browser sends participates in
-- the decision. That is the whole ownership model, and the security-definer
-- functions in the next migration reuse it rather than inventing a second one.
drop policy if exists "Teachers read their own students" on students;
create policy "Teachers read their own students" on students
  for select to authenticated
  using ((select auth.uid()) = teacher_id);

-- Note what is NOT here, because the boundary should be explicit rather than
-- implied: there is no teacher policy on progress, test_attempts,
-- daily_checkins or weekly_checkins. A teacher can see that a student exists,
-- what they are called, and whether they still owe us a PIN change -- and not
-- one answer, score or mood. Showing a teacher their class's progress is a
-- separate piece of work, and it needs its own thinking about what the
-- teacher of a deliberately anonymous student ought to be able to see.

-- ---------------------------------------------------------------------------
-- After running this
-- ---------------------------------------------------------------------------
-- 1. Create the first teacher:
--
--      node --env-file=.env scripts/create-teacher.ts you@school.uk \
--        --school "a partner school"
--
-- 2. Any students created before teacher accounts existed have teacher_id null
--    and are therefore invisible to every teacher -- the policy above matches
--    nothing, because null is never equal to anything. Assign them by hand,
--    once, with the uuid the script printed:
--
--      update students set teacher_id = '<teacher-uuid>' where teacher_id is null;
--
--    From then on scripts/create-students.ts --teacher <uuid> sets it at
--    creation time, as it always could.
