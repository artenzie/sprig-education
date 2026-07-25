-- Sprig: move student login onto Supabase's native auth.
--
-- Until now `students` was a standalone table with its own `pin` column --
-- the sketch of a hand-rolled credential store. We're replacing that with
-- Supabase Auth. Each student becomes a real row in `auth.users`, and their
-- PIN becomes that user's password: bcrypt-hashed by Supabase, and from this
-- point on unreadable by us or by anyone else. (A forgotten PIN is therefore
-- reset by a teacher, never recovered.)
--
-- The keystone is the `drop default` plus the foreign key below: students.id
-- STOPS generating its own uuid and instead *is* the auth user's id. That
-- change is what makes every RLS policy in the next migration possible:
-- auth.uid() -- the id of whoever is making the request, read out of a signed
-- token -- can then be compared directly against students.id, and against the
-- student_id column on progress, test_attempts, daily_checkins and
-- weekly_checkins. No join, no lookup table, no trust placed in the browser.
--
-- PRECONDITION: `select count(*) from students;` must return 0. Nothing in
-- the app has ever written to this table, so it should. If it doesn't, stop
-- and deal with those rows first -- the rewiring below cannot invent auth
-- users for students that already exist.

-- The PIN now lives in auth.users.encrypted_password. A second copy here
-- would be a liability, not a feature.
alter table students drop column if exists pin;

-- id must now be supplied by the caller, and must be a real auth user.
-- `on delete cascade`: deleting the auth user cleans up the student row and,
-- through the existing foreign keys, everything hanging off it -- rather
-- than leaving orphaned progress behind.
alter table students alter column id drop default;

-- Wrapped in a guard because `add constraint` has no `if not exists` form, and
-- these migrations are applied by pasting them into the SQL Editor by hand --
-- a process that has already produced a half-applied script once in this
-- project (see 20260724050000_dedupe_topic_I_III_slides.sql). Everything else
-- in this file is naturally re-runnable; this makes the whole file so.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'students_id_fkey'
       and conrelid = 'public.students'::regclass
  ) then
    alter table students
      add constraint students_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- Every student is created on the shared starter PIN and has to choose their
-- own before they can reach anything else. Enforced in src/routes/RequireAuth.tsx
-- and flipped only by public.complete_pin_change() in the next migration.
alter table students add column if not exists must_change_pin boolean not null default true;

-- Nickname is the login identifier, so it has to be unique -- it wasn't.
-- Indexed on lower() because logging in is case-insensitive: "Curious Squirrel"
-- and "curious squirrel" must not be two different accounts.
create unique index if not exists students_nickname_lower_key on students (lower(nickname));
