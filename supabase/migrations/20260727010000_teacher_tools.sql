-- Sprig: the two things a teacher actually needs on day one.
--
-- A student turns up at a lesson and cannot get in. There are exactly two
-- reasons, and until now neither had a remedy:
--
--   1. LOCKED OUT. Five wrong PINs locks a nickname for fifteen minutes
--      (20260725020000_login_lockout.sql). Nothing could lift that early:
--      login_attempts has RLS on with no policies and no grants, withheld even
--      from service_role on purpose, and clear_login_attempts() needs the
--      student's own session -- which is precisely what they cannot get while
--      locked. src/context/AuthProvider.tsx says so in a comment and ends
--      "Restore that sentence once teacher tooling can actually clear a lock."
--      This is that tooling.
--
--   2. FORGOTTEN PIN. The PIN is a bcrypt hash in auth.users, unreadable by
--      anyone including us -- that was the point of moving onto Supabase Auth.
--      Resetting one normally means the admin API, which means the
--      service-role key, which can never go near a browser.
--
-- Both are solved the same way this project has solved every problem of the
-- shape "the client must cause something it is not allowed to do": a
-- security-definer function. `security definer` means the function runs with
-- the privileges of its OWNER rather than its caller, so it can perform writes
-- the caller could never perform directly -- while the function body decides,
-- in the database, whether this particular caller is entitled to this
-- particular effect. Same pattern as complete_pin_change() and the lockout
-- trio; this file just has more at stake, so the guards are explicit and
-- shared rather than written out per function.
--
-- `set search_path = ''` on every one of them is the standard hardening:
-- without it the caller controls where an unqualified name like `students`
-- resolves and could point it at a table of their own. With an empty
-- search_path nothing resolves implicitly, which is why every single name
-- below is schema-qualified -- including extensions.crypt() and friends.
--
-- Run 20260727000000_teacher_accounts.sql first; this file depends on
-- teachers.id being an auth.users id.

-- ---------------------------------------------------------------------------
-- The audit trail
-- ---------------------------------------------------------------------------
-- Every teacher action against a student account is recorded, and this table
-- is most of what turns "a compromised teacher account is invisible" into "a
-- compromised teacher account is obvious the moment anyone looks".
--
-- It is also the rate limiter's memory -- see teacher_action_budget_ok() below
-- -- which is why it stores the timestamp of every action rather than just the
-- latest one per student.
create table if not exists teacher_actions (
  id         bigint generated always as identity primary key,
  teacher_id uuid not null references teachers(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  action     text not null check (action in ('unlock', 'reset_pin')),
  at         timestamptz not null default now()
);

-- Both reads this table serves -- "show me my history" and "how many actions
-- in the last hour" -- filter by teacher and sort by time.
create index if not exists teacher_actions_teacher_at_idx
  on teacher_actions (teacher_id, at desc);

alter table teacher_actions enable row level security;

-- Read your own history; never write it. There is a select grant and a select
-- policy and nothing else, so the only inserts that can ever happen are the
-- ones the functions below make as the table's owner. A teacher cannot forge a
-- record of something they did not do, and -- the part that matters -- cannot
-- erase a record of something they did.
grant select on teacher_actions to authenticated;

drop policy if exists "Teachers read own actions" on teacher_actions;
create policy "Teachers read own actions" on teacher_actions
  for select to authenticated
  using ((select auth.uid()) = teacher_id);

-- ---------------------------------------------------------------------------
-- Guard 1: ownership
-- ---------------------------------------------------------------------------
-- The single place that decides who may act on whom, so the two actions cannot
-- drift apart later. Note what it takes and what it does NOT take: a student
-- id, and nothing else. The teacher is derived from auth.uid(), read out of a
-- JWT Supabase signed. There is deliberately no p_teacher_id parameter --
-- offering one would mean trusting the browser to name itself, which is the
-- entire class of bug this design exists to make impossible.
--
-- The join through `teachers` looks redundant next to `s.teacher_id = ...` and
-- isn't: it also proves the caller IS a teacher. Students are `authenticated`
-- too, and this way a student session fails the check structurally rather than
-- incidentally.
--
-- security definer so it behaves the same wherever it is called from, and
-- granted to nobody -- the functions below reach it as the owner.
create or replace function public.teacher_owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.students s
      join public.teachers t on t.id = s.teacher_id
     where s.id = p_student_id
       and t.id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Guard 2: a ceiling
-- ---------------------------------------------------------------------------
-- Ownership bounds a compromised teacher account to one class. This bounds how
-- fast it can work through that class.
--
-- Forty an hour is deliberately blunt: comfortably above a real class of thirty
-- having a genuinely terrible morning, comfortably below a script walking the
-- roster resetting everything. A teacher who legitimately hits it waits an
-- hour and grumbles; that is the right trade for a pilot, and the number is
-- here in one place when it turns out to be wrong.
create or replace function public.teacher_action_budget_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 40
    from public.teacher_actions
   where teacher_id = auth.uid()
     and at > now() - interval '1 hour'
$$;

-- ---------------------------------------------------------------------------
-- Clearing a lockout
-- ---------------------------------------------------------------------------
-- login_attempts is keyed by NICKNAME SLUG, not student id -- deliberately, so
-- that failures against nicknames which don't exist are counted too (if only
-- real nicknames locked, the lockout would tell an attacker which nicknames
-- were worth attacking). So this has to translate: student id -> nickname ->
-- slug, using the same public.nickname_slug() the login path uses.
--
-- It deletes the row rather than just clearing locked_until. Same reasoning as
-- record_failed_login()'s treatment of an expired lock: wiping the row
-- restarts failed_count from zero, so an unlocked student gets a full set of
-- tries rather than one wrong guess away from being locked again.
create or replace function public.teacher_unlock_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.teacher_owns_student(p_student_id) then
    raise exception 'That student is not yours to unlock.';
  end if;
  if not public.teacher_action_budget_ok() then
    raise exception 'Too many account changes in the last hour. Try again later.';
  end if;

  delete from public.login_attempts
   where nickname_slug = (
     select public.nickname_slug(s.nickname)
       from public.students s
      where s.id = p_student_id
   );

  insert into public.teacher_actions (teacher_id, student_id, action)
  values (auth.uid(), p_student_id, 'unlock');
end;
$$;

-- ---------------------------------------------------------------------------
-- A fresh PIN worth handing out
-- ---------------------------------------------------------------------------
-- Six random digits, avoiding exactly the shapes describeWeakPin() in
-- src/lib/studentAuth.ts refuses to let a student choose. There would be
-- something absurd about a teacher resetting an account to 123456 when the app
-- would reject that same PIN thirty seconds later on the /set-pin screen.
--
-- gen_random_bytes rather than random(): random() is a fast PRNG seeded
-- predictably and is not meant for anything anyone has to guess. This PIN is a
-- credential, however briefly.
--
-- Not security definer -- it touches nothing privileged, and every extra
-- definer function is a little more surface to reason about. It runs as the
-- owner anyway when teacher_reset_pin calls it.
create or replace function public.random_student_pin()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- Every ascending and descending run of six digits. isRun() in studentAuth.ts
  -- computes these; there are only ten, so listing them is clearer than
  -- reimplementing the arithmetic and obviously agrees with it.
  v_runs text[] := array[
    '012345', '123456', '234567', '345678', '456789',
    '543210', '654321', '765432', '876543', '987654'
  ];
  v_pin text;
begin
  loop
    -- Four random bytes -> hex -> bit(32) -> bigint, then the low six decimal
    -- digits, zero-padded. abs() is belt and braces: widening bit(32) to
    -- bigint should zero-fill and never produce a negative, but a negative
    -- would silently produce a five-character PIN with a minus sign, and
    -- that failure would surface as "the student can't log in" days later.
    v_pin := lpad(
      (abs(('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
       % 1000000)::text,
      6, '0');

    exit when v_pin <> '000000'          -- the shared starter PIN
          and v_pin !~ '^(.)\1{5}$'      -- one digit repeated six times
          and not (v_pin = any(v_runs)); -- a straight run
  end loop;

  return v_pin;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resetting a forgotten PIN
-- ---------------------------------------------------------------------------
-- This writes a bcrypt hash straight into auth.users.encrypted_password, using
-- pgcrypto's crypt() with a blowfish salt -- the same algorithm GoTrue itself
-- uses, so the student's next sign-in verifies against it as if Supabase had
-- written it.
--
-- Be clear-eyed about this: reaching into the auth schema is something Supabase
-- discourages, and the supported route is an Edge Function holding the
-- service-role key calling auth.admin.updateUserById(). That is the same
-- upgrade path 20260725020000 already names for the lockout's own weaknesses,
-- and the two should be done together. Until then this is the free-plan answer,
-- and its failure mode is worth knowing: if a future GoTrue changed how
-- passwords are stored, this update would still SUCCEED and the student still
-- would not be able to log in. Which is why the verification for this feature
-- is "sign in with the new PIN", never "the function returned without error".
--
-- Four things have to happen together, and the order does not matter but the
-- completeness does. Miss any one and the reset half-works in a way that is
-- maddening to diagnose from the front of a classroom.
create or replace function public.teacher_reset_pin(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin text;
begin
  if not public.teacher_owns_student(p_student_id) then
    raise exception 'That student is not yours to reset.';
  end if;
  if not public.teacher_action_budget_ok() then
    raise exception 'Too many account changes in the last hour. Try again later.';
  end if;

  v_pin := public.random_student_pin();

  -- 1. The credential itself.
  update auth.users
     set encrypted_password = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_student_id;

  -- 2. Back into the forced-change flow. A PIN a teacher read aloud across a
  --    classroom is not a secret, so RequireAuth should funnel them to
  --    /set-pin before they reach anything else -- exactly as it does for a
  --    newly created account on 000000.
  update public.students
     set must_change_pin = true
   where id = p_student_id;

  -- 3. Clear the lockout. A student who forgot their PIN has almost certainly
  --    just guessed at it five times; handing them a new PIN they cannot use
  --    for another quarter of an hour would look exactly like the reset having
  --    failed.
  delete from public.login_attempts
   where nickname_slug = (
     select public.nickname_slug(s.nickname)
       from public.students s
      where s.id = p_student_id
   );

  -- 4. Kill live sessions. Changing a password does not invalidate sessions
  --    already issued against the old one -- so without this, whoever was
  --    signed in as this student stays signed in, which defeats the point of
  --    resetting a credential that may have been shared or guessed. Deleting
  --    the session cascades to its refresh token, so the next refresh fails
  --    and the browser is signed out.
  delete from auth.sessions where user_id = p_student_id;

  insert into public.teacher_actions (teacher_id, student_id, action)
  values (auth.uid(), p_student_id, 'reset_pin');

  -- The only moment this PIN exists in readable form, anywhere. It is not
  -- stored, not logged, and cannot be retrieved again -- if the teacher misses
  -- it, the remedy is another reset.
  return jsonb_build_object('pin', v_pin);
end;
$$;

-- ---------------------------------------------------------------------------
-- Which of my students are locked right now
-- ---------------------------------------------------------------------------
-- The roster itself is an ordinary RLS-filtered select on `students` -- see the
-- "Teachers read their own students" policy in 20260727000000. But lock state
-- lives in login_attempts, which no client can read at all and should not be
-- able to. So this exposes precisely that one fact, for precisely the caller's
-- own students.
--
-- It returns ONLY currently-locked students, and ONLY the expiry time. Not
-- failed_count -- that would let a teacher watch a classmate's guessing happen
-- in real time, which is a surveillance feature nobody asked for and a leak of
-- attempts made against a nickname by someone who is not its owner.
create or replace function public.teacher_student_lockouts()
returns table (student_id uuid, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, la.locked_until
    from public.students s
    join public.login_attempts la
      on la.nickname_slug = public.nickname_slug(s.nickname)
   where s.teacher_id = auth.uid()
     and la.locked_until is not null
     and la.locked_until > now()
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so each
-- revoke has to come before its grant -- otherwise granting to `authenticated`
-- would add nothing and take nothing away.

-- Internal. No client ever calls these; the definer functions reach them as
-- their owner.
revoke execute on function public.teacher_owns_student(uuid) from public;
revoke execute on function public.teacher_action_budget_ok() from public;
revoke execute on function public.random_student_pin() from public;

-- The three a teacher's session may call. `authenticated` covers students too,
-- which is fine and is the point of the guards: a student holds a valid JWT,
-- so they can reach these functions -- and teacher_owns_student() will refuse
-- them, including against their own id.
revoke execute on function public.teacher_unlock_student(uuid) from public;
grant execute on function public.teacher_unlock_student(uuid) to authenticated;

revoke execute on function public.teacher_reset_pin(uuid) from public;
grant execute on function public.teacher_reset_pin(uuid) to authenticated;

revoke execute on function public.teacher_student_lockouts() from public;
grant execute on function public.teacher_student_lockouts() to authenticated;

-- ---------------------------------------------------------------------------
-- Before running this, check three things
-- ---------------------------------------------------------------------------
-- All three are assumptions this file makes about the ENVIRONMENT rather than
-- about Sprig -- the kind of thing that is obvious today and baffling in six
-- months. They matter more than usual here because of when they would
-- otherwise fail: the risky calls all live inside plpgsql function bodies,
-- which Postgres does NOT validate at creation time. A wrong schema or a
-- missing privilege would not fail when this file is pasted in. It would fail
-- the first time a teacher resets a PIN, in front of a class.
--
-- Run all three first. Each one takes a second and none of them change data.
--
-- 1. Is pgcrypto where this file assumes?
--
--      select extnamespace::regnamespace as pgcrypto_schema
--        from pg_extension
--       where extname = 'pgcrypto';
--
--    Expect `extensions`, which is where Supabase puts it. Because
--    search_path is empty here, every call has to be qualified, so anything
--    else means adjusting the three extensions.* call sites in
--    random_student_pin() and teacher_reset_pin() to match. ZERO ROWS means
--    pgcrypto is not installed at all:
--
--      create extension pgcrypto with schema extensions;
--
-- 2. Does bcrypt actually round-trip?
--
--      select extensions.crypt('123456', h) = h as bcrypt_roundtrip_ok
--        from (select extensions.crypt('123456', extensions.gen_salt('bf')) as h) t;
--
--    Expect true. This exercises the exact pair of calls teacher_reset_pin()
--    makes to produce a hash GoTrue will later verify against, so it catches a
--    wrong schema and a broken hash in one go.
--
-- 3. Can the owner of these functions write what the reset writes?
--
--      begin;
--        update auth.users
--           set encrypted_password = encrypted_password,
--               updated_at         = updated_at
--         where false;
--
--        delete from auth.sessions where false;
--      rollback;
--
--    Expect no error. A security definer function runs as its OWNER, and
--    pasting this into the SQL Editor makes that owner `postgres` -- which
--    Supabase grants rights on the auth schema, but that is a platform detail
--    rather than a promise.
--
--    Note what this names explicitly. Postgres has column-level privileges, so
--    write access to updated_at would not prove write access to
--    encrypted_password; and the reset also deletes from auth.sessions, which
--    is a separate table with separate grants. Between them, these two
--    statements touch everything teacher_reset_pin() touches. `where false`
--    matches nothing, so no data changes even before the rollback -- but
--    permissions are still checked, which is the whole point.
--
--    If this errors, teacher_reset_pin() cannot work as written and the Edge
--    Function route described above is the way forward.
--
-- One consolation if check 3 is wrong and gets run anyway: the auth.users
-- update is the FIRST write teacher_reset_pin() makes. If it is refused the
-- function aborts and the whole statement rolls back -- so a permissions
-- failure leaves the student exactly as they were, rather than half-reset with
-- a PIN nobody knows.
