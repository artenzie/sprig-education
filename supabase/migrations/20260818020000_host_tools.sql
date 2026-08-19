-- Sprig: the two teacher actions, and the feedback inbox, for a host.
--
-- 20260818010000_host_role.sql gave a host broad READ access and stopped
-- there, on purpose. This file is the small, audited write surface that goes
-- with it, plus the one read that could not be done with a policy.
--
-- Three things happen here:
--
--   1. Unlock and reset-PIN start working across every class, rather than only
--      the caller's own -- because "the host can reset any student's PIN" was
--      the whole point of asking for a host in the first place. A forgotten
--      PIN at a school whose teacher is on holiday should not be unfixable.
--   2. Those actions record whether they crossed a class boundary, so the
--      audit log distinguishes a teacher fixing their own student from a host
--      reaching into somebody else's class.
--   3. help_messages becomes readable -- by a host, through a function, and in
--      no other way.
--
-- Run 20260818010000_host_role.sql first; everything here calls is_host().

-- ---------------------------------------------------------------------------
-- Who may act on whom
-- ---------------------------------------------------------------------------
-- teacher_owns_student() is deliberately NOT edited.
--
-- The obvious one-line version of this whole file was to redefine that
-- function as `... or public.is_host()` and change nothing else. It was
-- rejected for a reason worth writing down: the function would then return
-- true for a student the caller demonstrably does not own, and a guard whose
-- name contradicts its behaviour is how a future reader reaches a wrong
-- conclusion quickly and confidently. It would also widen, silently, every
-- future call site that reaches for the obvious-sounding name.
--
-- So ownership keeps meaning ownership, and the widening gets its own name and
-- exactly one definition.
create or replace function public.may_act_on_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.teacher_owns_student(p_student_id) or public.is_host()
$$;

-- Internal, like the guards it composes. The action functions reach it as
-- their owner; no client ever calls it.
revoke execute on function public.may_act_on_student(uuid) from public;

-- ---------------------------------------------------------------------------
-- Marking a cross-class action in the audit trail
-- ---------------------------------------------------------------------------
-- teacher_actions has recorded who did what to whom since 20260727010000, and
-- whether it was refused since 20260808000000. Neither is quite enough now: a
-- host's actions would otherwise be indistinguishable from a teacher's, and
-- the single most interesting thing about a host's action is precisely that it
-- reached somewhere a teacher could not.
--
-- The column means "this was allowed ONLY because the caller is a host" -- so
-- a host resetting one of their OWN students records false, exactly like any
-- other teacher, because ownership alone would have permitted it.
--
-- `default false` backfills every existing row correctly: nothing before this
-- migration could have crossed a class boundary, because nothing could.
alter table teacher_actions
  add column if not exists via_host boolean not null default false;

-- ---------------------------------------------------------------------------
-- The two actions
-- ---------------------------------------------------------------------------
-- Both bodies are otherwise UNCHANGED from
-- 20260808000000_teacher_action_outcomes.sql -- deliberately reproduced whole
-- rather than patched, which is how every function in this schema has been
-- revised, and which means the two files diff cleanly. Reading that diff, the
-- only differences are:
--
--   * the guard is may_act_on_student() rather than teacher_owns_student()
--   * v_via_host is computed and stored on each teacher_actions insert
--
-- Everything else -- the refusal payloads, the foreign_key_violation swallow,
-- the 40/hour budget, the four writes a reset performs, the order they happen
-- in -- is the same code doing the same thing.
--
-- Note what is NOT relaxed: teacher_action_budget_ok() still counts every
-- action in the last hour and still caps at 40, for a host as much as for
-- anybody. A host walking a whole cohort resetting PINs gets throttled like a
-- compromised teacher account would, which is the correct behaviour for both.
create or replace function public.teacher_unlock_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Computed before the guard so the log line can say HOW the action was
  -- permitted, not merely that it was.
  v_via_host boolean := not public.teacher_owns_student(p_student_id);
begin
  if not public.may_act_on_student(p_student_id) then
    begin
      insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
      values (auth.uid(), p_student_id, 'unlock', 'refused_not_owner', false);
    exception when foreign_key_violation then
      -- p_student_id doesn't name any real student at all -- blind probing
      -- rather than a targeted guess against a real (but not-owned) id.
      -- There's nothing to attach the row to, so this one attempt goes
      -- unlogged. Accepted gap: student ids are random UUIDs, not an
      -- enumerable space, so this isn't the probing pattern that matters.
      null;
    end;
    return jsonb_build_object('ok', false, 'message', 'That student is not yours to unlock.');
  end if;

  if not public.teacher_action_budget_ok() then
    insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
    values (auth.uid(), p_student_id, 'unlock', 'refused_rate_limited', v_via_host);
    return jsonb_build_object(
      'ok', false,
      'message', 'Too many account changes in the last hour. Try again later.'
    );
  end if;

  delete from public.login_attempts
   where nickname_slug = (
     select public.nickname_slug(s.nickname)
       from public.students s
      where s.id = p_student_id
   );

  insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
  values (auth.uid(), p_student_id, 'unlock', 'succeeded', v_via_host);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.teacher_reset_pin(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin text;
  v_via_host boolean := not public.teacher_owns_student(p_student_id);
begin
  if not public.may_act_on_student(p_student_id) then
    begin
      insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
      values (auth.uid(), p_student_id, 'reset_pin', 'refused_not_owner', false);
    exception when foreign_key_violation then
      null; -- see the matching comment in teacher_unlock_student() above.
    end;
    return jsonb_build_object('ok', false, 'message', 'That student is not yours to reset.');
  end if;

  if not public.teacher_action_budget_ok() then
    insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
    values (auth.uid(), p_student_id, 'reset_pin', 'refused_rate_limited', v_via_host);
    return jsonb_build_object(
      'ok', false,
      'message', 'Too many account changes in the last hour. Try again later.'
    );
  end if;

  v_pin := public.random_student_pin();

  update auth.users
     set encrypted_password = extensions.crypt(v_pin, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_student_id;

  update public.students
     set must_change_pin = true
   where id = p_student_id;

  delete from public.login_attempts
   where nickname_slug = (
     select public.nickname_slug(s.nickname)
       from public.students s
      where s.id = p_student_id
   );

  delete from auth.sessions where user_id = p_student_id;

  insert into public.teacher_actions (teacher_id, student_id, action, outcome, via_host)
  values (auth.uid(), p_student_id, 'reset_pin', 'succeeded', v_via_host);

  return jsonb_build_object('ok', true, 'pin', v_pin);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock state, cohort-wide
-- ---------------------------------------------------------------------------
-- Same widening, same shape. login_attempts has RLS on with no policies and no
-- grants to anyone, so this function is the only way lock state reaches a
-- browser at all -- and it still returns only currently-locked students, and
-- still only the expiry time. Not failed_count, for the reason 20260727010000
-- gives: watching a child's guessing happen live is a surveillance feature
-- nobody asked for, and a host having it would be worse, not better.
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
   where (s.teacher_id = auth.uid() or public.is_host())
     and la.locked_until is not null
     and la.locked_until > now()
$$;

-- ---------------------------------------------------------------------------
-- The feedback inbox
-- ---------------------------------------------------------------------------
-- 20260817000000 gave help_messages RLS with no policies and no grants at all,
-- and was emphatic about why: "Reads: nobody. Not students, not teachers. A
-- help message is between the sender and Artem, and one child's message about
-- something upsetting is not a thing a teacher should be able to read on a
-- whim." That is unchanged. A teacher still cannot read this table, and the
-- host who can is the person that sentence already named as the reader.
--
-- WHY A FUNCTION AND NOT A POLICY, when the other six host reads are policies.
--
-- Because a policy would need a grant first, and this is the one table that
-- has none. `grant select on help_messages to authenticated` would make the
-- table reachable by every signed-in user in the project, with a single policy
-- standing between them and it -- and a future migration that adds a
-- well-meaning second policy would widen it without anyone noticing, because
-- the grant would already be there. Leaving the grant off means help_messages
-- stays structurally unreadable and this function is the only door, which is
-- exactly the property the original migration was protecting.
--
-- Returns the nickname rather than the student id: an id is useless to a
-- reader and the nickname is the only name a Sprig student has. LEFT join, so
-- the anonymous messages that 20260817000000 went out of its way to keep
-- possible (a student who cannot get past the login screen, a teacher
-- evaluating Sprig) still appear, with a null nickname.
--
-- Returns zero rows rather than raising for a non-host. Every other read in
-- this schema answers "not for you" with an empty result rather than an error,
-- and the only caller is a page a non-host cannot reach anyway.
create or replace function public.host_help_messages()
returns table (id bigint, created_at timestamptz, message text, nickname text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.created_at, h.message, s.nickname
    from public.help_messages h
    left join public.students s on s.id = h.student_id
   where public.is_host()
   order by h.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- teacher_unlock_student, teacher_reset_pin and teacher_student_lockouts keep
-- the grants they already have -- CREATE OR REPLACE preserves them, and none
-- of the three changed signature, which is the thing that would have forced a
-- drop.
--
-- Only the new function needs one. `authenticated` covers students and
-- non-host teachers too, and that is fine and is the point of the guard: they
-- can call it, and the `where public.is_host()` inside gives them nothing.
revoke execute on function public.host_help_messages() from public;
grant execute on function public.host_help_messages() to authenticated;

-- ---------------------------------------------------------------------------
-- After running this
-- ---------------------------------------------------------------------------
-- Re-run the checks. The one that matters most here is the cross-class reset:
--
--      node --env-file=.env scripts/check-rls.ts --baseline rls-baseline.json
--
-- A host resetting another class's student must succeed; a non-host teacher
-- and a student attempting the same must both be refused, and the refusal must
-- appear in teacher_actions. And per the standing rule from
-- 20260727010000: a reset is verified by SIGNING IN with the new PIN, never by
-- the function returning cleanly. This file writes a bcrypt hash straight into
-- auth.users and its failure mode is silent.
--
--      select t.email, ta.action, ta.outcome, ta.via_host, ta.at
--        from teacher_actions ta join teachers t on t.id = ta.teacher_id
--       order by ta.at desc limit 10;
