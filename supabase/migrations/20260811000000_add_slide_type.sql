-- Tier 4 needs slides that preserve whitespace (Python is indentation-
-- sensitive), which the current flat <p> render strips. slide_type lets the
-- renderer branch per-slide; the default keeps every existing slide (Tiers
-- 1-3) rendering exactly as it does today.

alter table slides
  add column if not exists slide_type text not null default 'text'
    check (slide_type in ('text', 'code'));
