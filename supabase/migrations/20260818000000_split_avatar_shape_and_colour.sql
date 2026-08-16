-- Sprig: split the avatar into a shape and a colour.
--
-- The original design (20260811010000) stored one `avatar_leaf` id per student
-- from a curated list of eight fixed shape+colour PAIRINGS -- 'maple-forest',
-- 'oak-mint' and so on. The pairing was the point: species and palette varied
-- together across the set, so a student picked a whole look rather than
-- assembling one.
--
-- Eight options turned out to be too few to feel like customization. Because
-- the ids were already written as `shape-colour`, the pairing was never really
-- a single value -- it was two values with a hyphen between them, and the
-- constraint list was the cross-product written out by hand. This migration
-- makes that explicit: two columns, two constraints, and every combination
-- available instead of the eight somebody happened to enumerate.
--
-- 8 shapes x 6 colours = 48 combinations, from a list of 14 allowed values.

-- ---------------------------------------------------------------------------
-- The two columns
-- ---------------------------------------------------------------------------
-- Both nullable with no default, exactly as `avatar_leaf` was: null means "no
-- leaf chosen yet," which the client reads as "fall back to the initials
-- circle." They are nullable INDEPENDENTLY on purpose -- a student who has
-- picked a shape but not yet a colour is a real state the picker passes
-- through, and the client fills the gap with a default rather than refusing to
-- render.
--
-- Allowed values stay pinned to src/components/sprig/leafAvatars.tsx. Colours
-- are all existing design-system tokens (see the palette block in
-- src/index.css) -- no new colours were invented for this.
alter table students add column if not exists avatar_shape  text;
alter table students add column if not exists avatar_colour text;

alter table students drop constraint if exists students_avatar_shape_check;
alter table students add constraint students_avatar_shape_check
  check (avatar_shape is null or avatar_shape in (
    'maple', 'oak', 'birch', 'willow', 'ivy', 'fern', 'ginkgo', 'clover'
  ));

alter table students drop constraint if exists students_avatar_colour_check;
alter table students add constraint students_avatar_colour_check
  check (avatar_colour is null or avatar_colour in (
    'forest', 'sage', 'mint', 'terracotta', 'gold', 'bark'
  ));

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Split on the LAST hyphen, not the first. Every current id happens to have
-- exactly one, so either would work today -- but a future shape called
-- 'four-leaf' would break a split-on-first, and this is the kind of thing that
-- is cheaper to get right now than to debug later.
--
-- split_part() counts from the left only, so the right-hand piece comes from
-- regexp: everything after the final hyphen, and everything before it.
update students
   set avatar_shape  = substring(avatar_leaf from '^(.*)-[^-]*$'),
       avatar_colour = substring(avatar_leaf from '-([^-]*)$')
 where avatar_leaf is not null
   and avatar_shape is null;

-- Guard against a silent partial backfill. If any row had an id that did not
-- split into two values the constraints above already accept, the whole
-- migration aborts here rather than leaving those students with a half-set
-- avatar that the client would quietly render as initials.
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
    from students
   where avatar_leaf is not null
     and (avatar_shape is null or avatar_colour is null);

  if v_orphans > 0 then
    raise exception 'avatar backfill left % row(s) unsplit -- aborting', v_orphans;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retiring the old column
-- ---------------------------------------------------------------------------
-- Dropped rather than left behind. Once the backfill above has run, nothing
-- reads `avatar_leaf` -- not the client, not the RPC -- and a column that
-- still holds a value nothing honours is exactly the sort of stale half-truth
-- sitting in the database that the rest of this schema works to avoid.
--
-- This is one-way: the pairing is recoverable from the two new columns, but
-- the column itself is gone. Acceptable here because Sprig has not launched
-- and the only rows are pilot and test accounts.
alter table students drop constraint if exists students_avatar_leaf_check;
alter table students drop column if exists avatar_leaf;

-- ---------------------------------------------------------------------------
-- Setting the chosen avatar
-- ---------------------------------------------------------------------------
-- students still has no update grant for `authenticated` (see
-- 20260725010000_student_rls_policies.sql), so this remains the only path from
-- the browser to these columns.
--
-- The old one-argument set_avatar_leaf(text) is dropped explicitly. Postgres
-- overloads on signature, so `create or replace` with two arguments would
-- have left BOTH functions callable -- and the dead one still writes to a
-- column that no longer exists, which would fail at call time rather than
-- here, where it is cheap to notice.
drop function if exists public.set_avatar_leaf(text);

create or replace function public.set_avatar_leaf(p_shape text, p_colour text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'set_avatar_leaf() requires a signed-in student';
  end if;

  -- Validated here as well as by the table constraints, so an unknown value
  -- fails with a message naming what was wrong instead of a raw
  -- check-violation surfacing in the UI.
  if p_shape is not null and p_shape not in (
    'maple', 'oak', 'birch', 'willow', 'ivy', 'fern', 'ginkgo', 'clover'
  ) then
    raise exception 'set_avatar_leaf() received an unknown shape: %', p_shape;
  end if;

  if p_colour is not null and p_colour not in (
    'forest', 'sage', 'mint', 'terracotta', 'gold', 'bark'
  ) then
    raise exception 'set_avatar_leaf() received an unknown colour: %', p_colour;
  end if;

  -- coalesce, so the picker can send one half at a time. Choosing a colour
  -- must not blank out the shape the student already chose, and the picker
  -- genuinely does send them separately -- two independent controls, two
  -- independent writes.
  update public.students
     set avatar_shape  = coalesce(p_shape,  avatar_shape),
         avatar_colour = coalesce(p_colour, avatar_colour)
   where id = auth.uid();
end;
$$;

revoke execute on function public.set_avatar_leaf(text, text) from public;
grant execute on function public.set_avatar_leaf(text, text) to authenticated;
