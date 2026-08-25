-- Sprig: move the fallback address in the rate-limit messages to the real
-- domain.
--
-- Sprig now owns sprig.education, with forwarding set up for
-- hello@sprig.education. The old sprig.study address was a placeholder and no
-- mail sent to it will arrive.
--
-- WHY THIS NEEDS A MIGRATION AT ALL. The same string was edited in
-- 20260817000000 and 20260820000000 in the same commit as the React changes,
-- but editing an applied migration changes nothing in a database that has
-- already run it -- Supabase records the version as applied and never replays
-- the file. That edit only fixes a fresh `supabase db reset`. The deployed
-- functions go on raising the old text until something redefines them, which
-- is what this file is for. The two must be kept in step: if these functions
-- are ever edited again, edit them in the originals too, or a reset and the
-- live database will disagree.
--
-- WHY THE MESSAGE MATTERS ENOUGH TO CHASE. Both of these fire when a global
-- ceiling is hit, and the honest note in the original migrations is that a
-- tripped limit takes the form away from honest users until the hour rolls
-- forward. The address in the message is the only way out of that for the
-- person reading it. An address that bounces turns a temporary block into a
-- dead end, which is precisely the failure the fallback exists to prevent.
--
-- Both functions below are reproduced verbatim from their original migrations
-- with one string changed each. The reasoning behind the guards, the numbers,
-- and the security-definer shape all lives in those files and is not repeated
-- here.

-- ---------------------------------------------------------------------------
-- submit_help_message -- from 20260817000000_help_messages.sql
-- ---------------------------------------------------------------------------
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
  if v_sender is not null
     and (select count(*)
            from public.help_messages
           where student_id = v_sender
             and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have sent a few messages already — please wait a little before sending another.';
  end if;

  -- Guard 2: a global ceiling, and the honest note about it. See the original
  -- migration for why a bigger number is not the answer if this ever fires in
  -- anger.
  if (select count(*)
        from public.help_messages
       where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Sprig is getting a lot of messages right now — please try again a bit later, or email hello@sprig.education.';
  end if;

  insert into public.help_messages (message, student_id)
  values (v_message, v_sender);
end;
$$;

-- `create or replace` preserves neither the grants nor the revoke, so both are
-- restated. Dropping them would leave the function executable by `public`,
-- which is a wider grant than the original migration intended.
revoke execute on function public.submit_help_message(text) from public;
grant execute on function public.submit_help_message(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_contact_request -- from 20260820000000_contact_requests.sql
-- ---------------------------------------------------------------------------
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
  if (select count(*)
        from public.contact_requests
       where email = v_email
         and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'We already have that address — Artem will be in touch.';
  end if;

  -- Guard 2: a global ceiling, with the same honest note as help_messages.
  if (select count(*)
        from public.contact_requests
       where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Sprig is getting a lot of requests right now — please try again later, or email hello@sprig.education.';
  end if;

  insert into public.contact_requests (email, message)
  values (v_email, v_message);
end;
$$;

revoke execute on function public.submit_contact_request(text, text) from public;
grant execute on function public.submit_contact_request(text, text) to anon, authenticated;
