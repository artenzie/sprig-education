-- Sprig: brute-force protection for student login.
--
-- Why this is hand-built. Supabase has a purpose-made "Password Verification
-- Attempt" auth hook that does exactly this -- GoTrue calls it on every
-- password check and the hook can reject the attempt -- but it is a
-- Teams/Enterprise feature, and this project is on the free plan. So we do it
-- ourselves, in Postgres.
--
-- What this does and does not protect against, stated plainly:
--
--   It DOES stop the realistic threat -- someone sitting at a classmate's
--   laptop working through likely PINs on the login form. Five wrong guesses
--   and the nickname is locked for fifteen minutes, which turns a 10-minute
--   guessing game into a multi-day one.
--
--   It does NOT stop someone who reads the JavaScript bundle, finds the
--   publishable key, and calls GoTrue's token endpoint directly in a loop --
--   they would simply never call these functions. Supabase's own per-IP rate
--   limit (Dashboard -> Authentication -> Rate Limits) is the backstop for
--   that. Closing the gap properly would mean routing every login through an
--   Edge Function holding the service-role key, so the client never talks to
--   the auth endpoint at all; that is the upgrade path, not what's here.
--
--   It also CUTS BOTH WAYS. record_failed_login has to be callable before
--   anyone is signed in, so `anon` can call it -- with any nickname. Someone
--   who worked out the nickname format (the word lists are in
--   scripts/create-students.ts, in this repo) could deliberately lock a whole
--   class out for fifteen minutes at a time. That is the unavoidable cost of a
--   lockout the client has to trigger: the same call that protects an account
--   can be used against it. The same Edge Function upgrade closes this too,
--   because then only the server could report a failure. Until then it is a
--   known, accepted limitation of a pilot -- worth knowing about before a
--   lesson goes wrong for reasons that look inexplicable.
--
-- The table is keyed by nickname slug rather than student id on purpose: when
-- a login fails we do not know who tried, and the nickname may not even
-- exist. Counting attempts against nicknames that don't exist is also
-- deliberate -- if only real nicknames locked out, the lockout itself would
-- tell an attacker which nicknames are worth attacking.

create table if not exists login_attempts (
  nickname_slug  text primary key,
  failed_count   int not null default 0,
  locked_until   timestamptz,
  last_failed_at timestamptz not null default now()
);

-- RLS on, and intentionally no policies and no grants of any kind. This table
-- is unreachable from the browser: the only way in is through the
-- security-definer functions below, which run as this table's owner and are
-- therefore exempt from its RLS. A student can never read the attempt counts
-- (which would leak which nicknames exist) or reset their own.
alter table login_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Failures allowed before the lock closes.
-- Mirrored by MAX_LOGIN_ATTEMPTS in src/lib/studentAuth.ts, which is used
-- only for wording the error message -- this function is the real rule.
create or replace function public.login_max_attempts()
returns int
language sql
immutable
as $$ select 5 $$;

-- How long a locked nickname stays locked.
create or replace function public.login_lock_duration()
returns interval
language sql
immutable
as $$ select interval '15 minutes' $$;

-- "  Curious   Squirrel " -> "curious-squirrel"
--
-- This MUST stay in step with nicknameToSlug() in src/lib/studentAuth.ts. The
-- two are what make login case- and punctuation-insensitive, and if they ever
-- disagree the lockout would count attempts against one key while the app
-- checks another.
create or replace function public.nickname_slug(p_nickname text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(coalesce(p_nickname, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- Shared shape for both of the status-returning functions below, so the
-- client only ever has one JSON contract to read.
create or replace function public.login_lockout_payload(p_row public.login_attempts)
returns jsonb
language sql
stable
as $$
  select case
    when p_row.locked_until is not null and p_row.locked_until > now() then
      jsonb_build_object(
        'locked', true,
        'locked_until', p_row.locked_until,
        'seconds_left', ceil(extract(epoch from (p_row.locked_until - now())))::int,
        'attempts_left', 0
      )
    else
      jsonb_build_object(
        'locked', false,
        'locked_until', null,
        'seconds_left', 0,
        'attempts_left', greatest(0, public.login_max_attempts() - coalesce(p_row.failed_count, 0))
      )
  end
$$;

-- ---------------------------------------------------------------------------
-- login_lockout_status -- called BEFORE the sign-in attempt.
-- ---------------------------------------------------------------------------
-- Lets the app refuse a locked nickname without touching the auth endpoint at
-- all, which keeps a locked-out student from burning through Supabase's
-- per-IP rate limit on behalf of their whole class.
create or replace function public.login_lockout_status(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.login_attempts;
begin
  select * into v_row
    from public.login_attempts
   where nickname_slug = public.nickname_slug(p_nickname);

  return public.login_lockout_payload(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- record_failed_login -- called AFTER a rejected sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.record_failed_login(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := public.nickname_slug(p_nickname);
  v_row  public.login_attempts;
begin
  -- Nothing usable was typed; don't create a row keyed on an empty string.
  if v_slug = '' then
    return public.login_lockout_payload(v_row);
  end if;

  -- An expired lock is no lock at all. Clearing the row rather than just the
  -- timestamp means the count restarts from zero, so a student who comes back
  -- fifteen minutes later gets a full set of tries again.
  delete from public.login_attempts
   where nickname_slug = v_slug
     and locked_until is not null
     and locked_until <= now();

  select * into v_row
    from public.login_attempts
   where nickname_slug = v_slug;

  -- Already locked: report it, but don't extend the lock. Otherwise someone
  -- hammering a nickname could keep another student locked out indefinitely.
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return public.login_lockout_payload(v_row);
  end if;

  insert into public.login_attempts as la (nickname_slug, failed_count, last_failed_at)
  values (v_slug, 1, now())
  on conflict (nickname_slug) do update
     set failed_count   = la.failed_count + 1,
         last_failed_at = now()
  returning * into v_row;

  if v_row.failed_count >= public.login_max_attempts() then
    -- Close the lock and zero the counter, so when the lock expires the next
    -- failure starts a fresh count rather than re-locking immediately.
    update public.login_attempts
       set locked_until = now() + public.login_lock_duration(),
           failed_count = 0
     where nickname_slug = v_slug
    returning * into v_row;
  end if;

  return public.login_lockout_payload(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- clear_login_attempts -- called AFTER a successful sign-in.
-- ---------------------------------------------------------------------------
-- Takes no argument on purpose. It derives the nickname from auth.uid(), so it
-- requires a valid session -- which means it is only reachable *after* someone
-- has proved they know the PIN, and it can only ever clear the caller's own
-- counter. Had it accepted a nickname, anyone could have kept a counter at
-- zero and made the lockout useless.
create or replace function public.clear_login_attempts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.login_attempts
   where nickname_slug = (
     select public.nickname_slug(s.nickname)
       from public.students s
      where s.id = auth.uid()
   );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE on a new function to PUBLIC by default, so each
-- revoke has to come before its grant -- otherwise granting to `anon` or
-- `authenticated` would add nothing and take nothing away.

-- Internal helpers: no client ever calls these directly. The security-definer
-- functions run as their owner, so they can still use them.
revoke execute on function public.login_max_attempts() from public;
revoke execute on function public.login_lock_duration() from public;
revoke execute on function public.nickname_slug(text) from public;
revoke execute on function public.login_lockout_payload(public.login_attempts) from public;

-- These two run before the student has a session, so `anon` needs them.
revoke execute on function public.login_lockout_status(text) from public;
grant execute on function public.login_lockout_status(text) to anon, authenticated;

revoke execute on function public.record_failed_login(text) from public;
grant execute on function public.record_failed_login(text) to anon, authenticated;

-- This one runs after sign-in, so it requires a session.
revoke execute on function public.clear_login_attempts() from public;
grant execute on function public.clear_login_attempts() to authenticated;
