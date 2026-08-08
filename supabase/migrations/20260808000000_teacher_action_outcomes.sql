-- Sprig: log refused teacher actions, not just successful ones.
--
-- teacher_unlock_student() and teacher_reset_pin() (20260727010000) only ever
-- inserted into teacher_actions on the path that reaches their final insert --
-- which means a refused attempt (teacher_owns_student() false, or the 40/hour
-- budget exhausted) left no trace at all. That's the exact case the audit
-- trail exists for: "a compromised teacher account is obvious the moment
-- anyone looks" only holds if probing shows up.
--
-- The obstacle is transactional, not conceptual. Both functions used to
-- `raise exception` the moment a guard failed, and a PostgREST RPC call is one
-- transaction -- any insert made earlier in the same call would be rolled back
-- right along with everything else when that exception reached the client
-- uncaught. Logging a refusal and then raising past it doesn't work; the log
-- row never survives.
--
-- The fix is to stop treating "not yours" and "too many actions" as
-- exceptions. They're expected, foreseeable outcomes of a security check --
-- the same category fetchTeacherStudents() already reports as {ok: false}
-- rather than throwing (src/lib/teacherAuth.ts). Both functions now always
-- return jsonb and never raise for these two guards, which means the call
-- completes and commits normally, log row included, whichever way the guard
-- went. Genuinely unexpected failures (a write that fails mid-function for
-- some other reason) still raise uncaught and still go unlogged -- exactly as
-- before, and appropriately so: those aren't "attempts against a student",
-- they're infrastructure surprises.

-- ---------------------------------------------------------------------------
-- The outcome of an attempt
-- ---------------------------------------------------------------------------
-- One column on the existing table, not a second table. A refusal and a
-- success are the same fact -- "an attempt happened" -- and both readers of
-- this table (a teacher's own history, and the budget's count of the last
-- hour) already query across all of them together; a second table would just
-- force a union at both call sites.
--
-- Backfilled to 'succeeded': every row written before this migration reached
-- the old insert, which only sat on the success path. The default is then
-- dropped so nothing written from here on can omit it by accident.
alter table teacher_actions
  add column outcome text not null default 'succeeded'
    check (outcome in ('succeeded', 'refused_not_owner', 'refused_rate_limited'));

alter table teacher_actions alter column outcome drop default;

-- Worth being explicit about, since it's a real behaviour change and not just
-- a schema addition: teacher_action_budget_ok() counts every row in the last
-- hour regardless of outcome, so refused attempts now spend the same 40/hour
-- ceiling a real action would. That's deliberate -- today probing costs
-- nothing because nothing gets inserted on refusal, so an account fishing for
-- another teacher's student ids never trips the budget at all. Counting
-- refusals closes that too: probing now throttles itself.

-- ---------------------------------------------------------------------------
-- Clearing a lockout
-- ---------------------------------------------------------------------------
-- Return type changes from void to jsonb, which CREATE OR REPLACE cannot do
-- in place -- the function has to be dropped and recreated. Its grant goes
-- with it, so the grants section at the bottom re-adds it.
drop function if exists public.teacher_unlock_student(uuid);

create function public.teacher_unlock_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.teacher_owns_student(p_student_id) then
    begin
      insert into public.teacher_actions (teacher_id, student_id, action, outcome)
      values (auth.uid(), p_student_id, 'unlock', 'refused_not_owner');
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
    insert into public.teacher_actions (teacher_id, student_id, action, outcome)
    values (auth.uid(), p_student_id, 'unlock', 'refused_rate_limited');
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

  insert into public.teacher_actions (teacher_id, student_id, action, outcome)
  values (auth.uid(), p_student_id, 'unlock', 'succeeded');

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Resetting a forgotten PIN
-- ---------------------------------------------------------------------------
-- Already returned jsonb, so this one can stay a CREATE OR REPLACE -- only the
-- body changes: the two guards return {ok: false, message} instead of
-- raising, and the success payload gains {ok: true} alongside the pin.
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
    begin
      insert into public.teacher_actions (teacher_id, student_id, action, outcome)
      values (auth.uid(), p_student_id, 'reset_pin', 'refused_not_owner');
    exception when foreign_key_violation then
      null; -- see the matching comment in teacher_unlock_student() above.
    end;
    return jsonb_build_object('ok', false, 'message', 'That student is not yours to reset.');
  end if;

  if not public.teacher_action_budget_ok() then
    insert into public.teacher_actions (teacher_id, student_id, action, outcome)
    values (auth.uid(), p_student_id, 'reset_pin', 'refused_rate_limited');
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

  insert into public.teacher_actions (teacher_id, student_id, action, outcome)
  values (auth.uid(), p_student_id, 'reset_pin', 'succeeded');

  return jsonb_build_object('ok', true, 'pin', v_pin);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- teacher_reset_pin's grant survives its CREATE OR REPLACE untouched.
-- teacher_unlock_student was dropped above and needs both back.
revoke execute on function public.teacher_unlock_student(uuid) from public;
grant execute on function public.teacher_unlock_student(uuid) to authenticated;
