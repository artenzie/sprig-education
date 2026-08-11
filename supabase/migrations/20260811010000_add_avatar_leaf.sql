-- Sprig: customizable leaf profile avatars.
--
-- Nullable, no default: null means "no leaf chosen yet," which the client
-- reads as "fall back to the initials circle." The allowed values are
-- pinned to the curated set in src/components/sprig/leafAvatars.tsx — if
-- that list changes, this constraint has to change with it.
alter table students add column if not exists avatar_leaf text;

alter table students drop constraint if exists students_avatar_leaf_check;
alter table students add constraint students_avatar_leaf_check
  check (avatar_leaf is null or avatar_leaf in (
    'maple-forest',
    'oak-mint',
    'birch-terracotta',
    'willow-gold',
    'ivy-forest',
    'fern-mint',
    'ginkgo-terracotta',
    'clover-gold'
  ));

-- ---------------------------------------------------------------------------
-- Setting the chosen leaf.
-- ---------------------------------------------------------------------------
-- students has no update grant for `authenticated` (see
-- 20260725010000_student_rls_policies.sql), so this is the only path from
-- the browser to this column -- modeled directly on complete_pin_change()
-- in that same file. The allowed-values check is repeated here rather than
-- relied on solely via the table constraint, so a bad id fails with a clear
-- message instead of a raw constraint-violation error reaching the client.
create or replace function public.set_avatar_leaf(leaf text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'set_avatar_leaf() requires a signed-in student';
  end if;

  if leaf is not null and leaf not in (
    'maple-forest',
    'oak-mint',
    'birch-terracotta',
    'willow-gold',
    'ivy-forest',
    'fern-mint',
    'ginkgo-terracotta',
    'clover-gold'
  ) then
    raise exception 'set_avatar_leaf() received an unknown leaf id: %', leaf;
  end if;

  update public.students
     set avatar_leaf = leaf
   where id = auth.uid();
end;
$$;

revoke execute on function public.set_avatar_leaf(text) from public;
grant execute on function public.set_avatar_leaf(text) to authenticated;
