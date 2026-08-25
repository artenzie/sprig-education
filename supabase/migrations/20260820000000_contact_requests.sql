-- Sprig: somewhere for an interested adult to leave an email address.
--
-- The Login page's Teacher/Parent box has always ended with "Teacher accounts
-- are set up for you during the pilot. Get in touch and we'll make you one" --
-- where "Get in touch" was a plain <span> that did nothing. This is the other
-- end of that sentence.
--
-- WHY NOT REUSE help_messages. Same security shape, different thing entirely:
--
--   - help_messages is a message with no reply path. It says so on the page:
--     "this box doesn't know who you are". The sender is a student, usually
--     signed in, and the row carries their student_id.
--   - contact_requests is the opposite. The whole point is the reply path. The
--     sender is an adult with no account and no student_id to carry, and the
--     email address IS the payload rather than an optional extra.
--
-- Merging them would mean a nullable email on a table where it is meaningless
-- for most rows, and a nullable student_id on a table where it is meaningless
-- for all of them. Two audiences, two purposes, two tables.

create table if not exists contact_requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Loose on purpose. RFC 5321 puts the practical ceiling at 254 characters,
  -- and beyond "has an @ that is not the first character" this does not try to
  -- validate. Every strict email regex rejects addresses that genuinely work,
  -- and the cost of accepting a typo here is one email that bounces -- not a
  -- security problem, and not something the sender can be helped with anyway
  -- since nothing on this path ever mails them to check.
  email text not null
    check (length(btrim(email)) between 3 and 254 and position('@' in email) > 1),

  -- Optional, and short. An email alone means every reply has to open by
  -- asking what they wanted; 400 characters is enough for "Head of Maths at X,
  -- interested in the September pilot" and too few for a support ticket, which
  -- is what /help is for.
  message text
    check (message is null or length(btrim(message)) between 1 and 400)
);

create index if not exists contact_requests_created_at_idx
  on contact_requests (created_at desc);

-- NO auth.uid() COLUMN, and that is the one real departure from help_messages.
-- Whoever fills this in is by definition someone without an account -- that is
-- what they are writing to ask for. The email address is the identity. A uid
-- column would be null on every row that matters and would only ever record
-- the odd signed-in person who used the form anyway.

-- RLS on, and -- as with help_messages -- *no policies and no grants* for any
-- browser role. Reads and writes both go nowhere from a browser: the RPC below
-- is the only way in, and host_contact_requests() the only way out.
alter table contact_requests enable row level security;

-- The service role bypasses RLS. That is the fallback reader (a local script,
-- or the Supabase dashboard) if the host page is ever unavailable.
grant all on contact_requests to service_role;

-- ---------------------------------------------------------------------------
-- Leaving an address
-- ---------------------------------------------------------------------------
-- Security-definer function rather than an INSERT policy, for exactly the
-- reason spelled out in 20260817000000: /login is public, so a policy would
-- have to be granted to `anon`, the publishable key is in the client bundle by
-- design, and `grant insert to anon` is an unauthenticated write endpoint
-- anyone who views source can script against. A policy can bound WHO writes.
-- It cannot bound what or how much.
create or replace function public.submit_contact_request(
  p_email   text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if v_email = '' then
    raise exception 'Please enter an email address.';
  end if;

  -- Checked here as well as in the column constraint so a bad address comes
  -- back as a sentence rather than as a raw check-violation.
  if position('@' in v_email) < 2 or length(v_email) > 254 then
    raise exception 'That does not look like an email address.';
  end if;

  if v_message is not null and length(v_message) > 400 then
    raise exception 'That note is a bit long — please keep it under 400 characters.';
  end if;

  -- Guard 1: a per-address ceiling.
  --
  -- The email is the only identity this form has, so it is the only thing a
  -- per-sender limit can key on. Three an hour covers an impatient
  -- double-submit and a genuine follow-up thought, and stops one address
  -- filling the table on its own.
  --
  -- Note this is trivially sidestepped by typing a different address, which is
  -- fine: it is here to make accidents cheap, not to stop an adversary. That
  -- job belongs to the global cap below, with the caveats attached to it.
  if (select count(*)
        from public.contact_requests
       where email = v_email
         and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'We already have that address — Artem will be in touch.';
  end if;

  -- Guard 2: a global ceiling, with the same honest note as help_messages.
  --
  -- This is a cost circuit-breaker, NOT a spam filter, and the trade is real:
  -- someone determined can trip it and take the form away from genuine
  -- teachers until the hour rolls forward. 30 an hour is half the help box's
  -- 60 because the expected traffic is entirely different -- a handful of
  -- adults over a pilot, against ninety students who might all hit a
  -- confusing lesson in the same period.
  --
  -- If this ever fires in anger the answer is a captcha, not a bigger number.
  -- The fallback in the message is a real address a person can use instead,
  -- which is what keeps a tripped limit from being a dead end.
  if (select count(*)
        from public.contact_requests
       where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Sprig is getting a lot of requests right now — please try again later, or email hello@sprig.education.';
  end if;

  insert into public.contact_requests (email, message)
  values (v_email, v_message);
end;
$$;

-- `anon` first and foremost. A parent or a teacher evaluating Sprig has no
-- account -- that is the entire reason this form exists -- so the unsigned
-- case is the normal one here, not the edge case.
revoke execute on function public.submit_contact_request(text, text) from public;
grant execute on function public.submit_contact_request(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reading them
-- ---------------------------------------------------------------------------
-- Shipped WITH a reader, deliberately, and this is the lesson from
-- 20260817000000 rather than a new idea. That migration records the Help box's
-- first two states: it answered a send with "Sent -- thank you" and a promise
-- of a reply within two days while doing nothing with the text at all, and the
-- table then sat unreadable with "There is no inbox UI yet" until the host
-- work three weeks later.
--
-- A form that says "Artem will get in touch" and drops the address into a
-- table nobody looks at is the same failure wearing a different label. So the
-- host section goes in with the table.
--
-- Returns zero rows rather than raising for a non-host, matching
-- host_help_messages() and every other read in this schema: "not for you" is
-- an empty result, not an error.
create or replace function public.host_contact_requests()
returns table (id bigint, created_at timestamptz, email text, message text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.created_at, c.email, c.message
    from public.contact_requests c
   where public.is_host()
   order by c.created_at desc
$$;

revoke execute on function public.host_contact_requests() from public;
grant execute on function public.host_contact_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- After running this
-- ---------------------------------------------------------------------------
-- Re-run the RLS probe. It now carries a "cannot read contact_requests
-- directly" invariant alongside the help_messages one:
--
--      node --env-file=.env scripts/check-rls.ts --baseline rls-baseline.json
--
-- The table must be unreadable for student, teacher AND host. A host reads it
-- through host_contact_requests(); if the direct read ever starts succeeding,
-- a grant has been added somewhere it should not have been.
