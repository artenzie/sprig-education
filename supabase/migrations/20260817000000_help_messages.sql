-- Sprig: somewhere for the Help page's contact box to actually put a message.
--
-- The box has been through two states. It began by answering a send with
-- "Sent -- thank you" and a promise of a reply within two days, while doing
-- nothing with the text at all. That was replaced by a mailto: link, which at
-- least reached a human but stored nothing and depended on the reader having a
-- working mail client -- not a safe assumption on a shared school machine.
--
-- This adds the missing half: the message is written down.

create table if not exists help_messages (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message    text not null check (length(btrim(message)) between 1 and 2000),
  -- Null for anyone not signed in. /help is a public route -- a teacher
  -- evaluating Sprig, or a student who cannot get past the login screen (very
  -- plausibly the reason they are writing), both need to reach this box.
  --
  -- `on delete set null` rather than cascade, deliberately, and it is the one
  -- exception to yesterday's cascade migration. A student leaving should not
  -- silently destroy a question that may still be unanswered, and once the id
  -- is gone the row carries nothing that identifies anybody.
  student_id uuid references students(id) on delete set null
);

create index if not exists help_messages_created_at_idx
  on help_messages (created_at desc);

-- RLS on, and -- unusually for this schema -- *no policies and no grants at
-- all*. Not an omission: this table is deliberately unreachable from any
-- browser in either direction.
--
-- Reads: nobody. Not students, not teachers. A help message is between the
-- sender and Artem, and one child's message about something upsetting is not a
-- thing a teacher should be able to read on a whim.
--
-- Writes: through submit_help_message() below and nowhere else. See the long
-- comment there for why an INSERT policy would have been the wrong shape.
alter table help_messages enable row level security;

-- The service role bypasses RLS, which is how these actually get read: from a
-- local script or the dashboard. There is no inbox UI yet.
grant all on help_messages to service_role;

-- ---------------------------------------------------------------------------
-- Sending a message
-- ---------------------------------------------------------------------------
-- WHY A FUNCTION AND NOT AN INSERT POLICY.
--
-- /help is public, so an INSERT policy would have to be granted to `anon`. The
-- publishable key is in the client bundle by design -- that is what publishable
-- means -- so `grant insert to anon` is an unauthenticated write endpoint that
-- anyone who views source can script against. The policy could bound *who*
-- writes, but nothing about *what* or *how much*.
--
-- A security-definer function bounds all three, and it is the idiom this schema
-- already uses everywhere the browser cannot be trusted with a decision:
-- record_failed_login() (also granted to anon), set_avatar_leaf(),
-- complete_pin_change(), the teacher tools.
--
-- The single most important line is `v_sender := auth.uid()`. The client never
-- supplies student_id and has no way to, so a message cannot be forged onto
-- another student's name. Compare an INSERT policy, where the client sends the
-- column and the policy can only check it afterwards.
create or replace function public.submit_help_message(p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_sender  uuid := auth.uid();
begin
  if v_message = '' then
    raise exception 'Please write a message before sending.';
  end if;

  -- Checked here as well as in the column constraint so an over-long message
  -- fails with a sentence a 13-year-old can act on, rather than a raw
  -- check-violation from Postgres surfacing in the UI.
  if length(v_message) > 2000 then
    raise exception 'That message is a bit too long — please keep it under 2000 characters.';
  end if;

  -- auth.uid() is whoever is signed in, which is not necessarily a STUDENT.
  -- Teachers are auth users too and can read /help like anyone else, and
  -- help_messages.student_id points at public.students -- so writing a
  -- teacher's uid straight in would fail on the foreign key. Fall back to
  -- anonymous instead: their message is still worth having.
  if v_sender is not null
     and not exists (select 1 from public.students where id = v_sender) then
    v_sender := null;
  end if;

  -- Guard 1: a per-student ceiling.
  --
  -- Five an hour is well above a student with a genuine problem writing twice
  -- because they thought of something else, and well below anything worth
  -- calling a flood.
  if v_sender is not null
     and (select count(*)
            from public.help_messages
           where student_id = v_sender
             and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have sent a few messages already — please wait a little before sending another.';
  end if;

  -- Guard 2: a global ceiling, and the honest note about it.
  --
  -- Anonymous senders have no identity to key a limit on, so the only lever
  -- left is a total. This is a cost circuit-breaker, NOT a spam filter, and the
  -- trade is real and worth stating: someone determined can trip it and take
  -- the form away from honest students until the hour rolls forward. Sixty an
  -- hour against a pilot of roughly ninety students across three schools is
  -- generous enough that normal use will never see it, which is the only reason
  -- the trade is acceptable.
  --
  -- If this ever fires in anger, the answer is not a bigger number here -- it
  -- is a captcha, or requiring a sign-in, and both are decisions with their own
  -- costs to a child who cannot log in.
  if (select count(*)
        from public.help_messages
       where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Sprig is getting a lot of messages right now — please try again a bit later, or email hello@sprig.education.';
  end if;

  insert into public.help_messages (message, student_id)
  values (v_message, v_sender);
end;
$$;

-- `anon` as well as `authenticated`, matching login_lockout_status() and
-- record_failed_login() -- the other two things a person who cannot sign in
-- still needs to be able to do.
revoke execute on function public.submit_help_message(text) from public;
grant execute on function public.submit_help_message(text) to anon, authenticated;
