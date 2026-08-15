-- Sprig: make deleting a student actually work.
--
-- THE BUG
--
-- Deleting a student who had ever completed a single lesson failed with an
-- opaque `500` and an empty error body from GoTrue. Deleting a student who had
-- done nothing worked fine. That difference is the whole clue.
--
-- The delete chain looks like this:
--
--   auth.users --ON DELETE CASCADE--> students --???--> progress
--                                                       test_attempts
--                                                       daily_checkins
--                                                       weekly_checkins
--
-- The first arrow was set up correctly, in 20260725000000_auth_students_table.sql:
-- `students.id references auth.users(id) on delete cascade`. The second arrow
-- was never given an ON DELETE action at all. From 20260721000000_init_schema.sql:
--
--   create table if not exists progress (
--     student_id uuid not null references students(id),   -- <- no ON DELETE
--     ...
--
-- A `references` clause with no ON DELETE defaults to **ON DELETE NO ACTION**,
-- which means "refuse to delete the parent row while any child still points at
-- it". So Postgres would begin cascading the auth.users delete down into
-- `students`, immediately hit a `progress` row still referencing that student,
-- raise a foreign key violation, and roll the whole transaction back. GoTrue
-- caught the unhandled database error and returned a bare 500.
--
-- WHY IT MATTERED
--
-- Not merely an inconvenience for test cleanup:
--
--   * Any student who had used the app at all became undeletable through the
--     normal admin path. Only students who had done literally nothing could go.
--   * A school asking for a pupil's data to be removed could not be served.
--     For a platform aimed at 13-14 year olds in UK schools that is a
--     data-protection problem, not a nice-to-have.
--   * The failure was undiagnosable from the outside. An empty 500 gives no
--     hint that a foreign key is the cause.
--
-- THE FIX
--
-- Give all four child tables `on delete cascade`. Every one of them holds data
-- that is meaningless without the student it belongs to -- a progress row for a
-- deleted student is not a record worth keeping, it is an orphan.
--
-- WHAT IS DELIBERATELY NOT CHANGED
--
-- `students.teacher_id` stays `on delete set null` (set in
-- 20260727000000_teacher_accounts.sql). That one is correct as it is and the
-- distinction is the point: deleting a *teacher* must orphan their pupils, not
-- delete them. Cascade there would mean removing a staff account wiped a whole
-- class. Two foreign keys, two different right answers.
--
-- `teacher_actions` already declares `on delete cascade` on both of its foreign
-- keys (20260727010000_teacher_tools.sql), so it is already correct and is left
-- alone. Its audit rows are meant to disappear with the teacher they belong to.
--
-- THE HABIT WORTH FORMING
--
-- Write the ON DELETE clause every single time you write a `references`, even
-- when the default is what you want, so the next reader can tell you decided
-- rather than forgot. This schema got it right in the two places where it was
-- consciously considered and silently defaulted everywhere else.

-- ---------------------------------------------------------------------------
-- The constraint swap
-- ---------------------------------------------------------------------------
--
-- The existing constraints were auto-named by Postgres and should be
-- `<table>_student_id_fkey`, but this looks them up by what they actually point
-- at rather than trusting that. Hardcoding a name we then failed to match would
-- be worse than useless: `drop constraint if exists` would silently no-op and
-- the `add` would leave a SECOND foreign key on the column, so the old
-- NO ACTION rule would still be there and still block deletes.
--
-- Dropping and re-adding revalidates the constraint (a full scan of each child
-- table). These tables are small, and it is the only way to change an ON DELETE
-- action -- Postgres has no `alter constraint ... set on delete`.
--
-- Re-runnable: on a second pass it finds the cascade version it created last
-- time, drops it, and puts back an identical one.
do $$
declare
  child_table text;
  existing_name text;
begin
  foreach child_table in array array['progress', 'test_attempts', 'daily_checkins', 'weekly_checkins']
  loop
    select c.conname
      into existing_name
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.conrelid = format('public.%I', child_table)::regclass
       and c.confrelid = 'public.students'::regclass
       and a.attname = 'student_id'
     limit 1;

    if existing_name is not null then
      execute format('alter table public.%I drop constraint %I', child_table, existing_name);
      raise notice 'dropped % on %', existing_name, child_table;
    else
      raise notice 'no existing student_id fkey found on % -- adding fresh', child_table;
    end if;

    execute format(
      'alter table public.%I
         add constraint %I
         foreign key (student_id) references public.students(id) on delete cascade',
      child_table,
      child_table || '_student_id_fkey'
    );
    raise notice 'added %_student_id_fkey with on delete cascade', child_table;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
--
-- Run this after applying. `confdeltype` is the ON DELETE action, as a single
-- char: 'c' = cascade, 'n' = set null, 'a' = no action, 'r' = restrict.
--
-- Expect 'c' for all four child tables below, and 'n' for students.teacher_id.
-- If teacher_id ever reads 'c', something has gone badly wrong -- deleting a
-- teacher would take their whole class with them.
--
--   select
--     con.conrelid::regclass  as child_table,
--     att.attname             as column_name,
--     con.confrelid::regclass as parent_table,
--     con.confdeltype         as on_delete
--   from pg_constraint con
--   join pg_attribute att
--     on att.attrelid = con.conrelid
--    and att.attnum = any (con.conkey)
--   where con.contype = 'f'
--     and (
--       (con.confrelid = 'public.students'::regclass and att.attname = 'student_id')
--       or (con.conrelid = 'public.students'::regclass and att.attname = 'teacher_id')
--     )
--   order by child_table;
--
-- The behavioural test matters more than the catalog read, because the catalog
-- cannot tell you the delete actually succeeds end to end. Create a throwaway
-- student, write a progress row and a test attempt for them, delete the auth
-- user, and confirm both the auth user and every dependent row are gone.
