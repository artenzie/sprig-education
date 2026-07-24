-- Tier 1 content support: slides, topic videos, and richer question types.

create table if not exists slides (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references subtopics(id),
  "order" int not null,
  heading text not null,
  body text
);

alter table topics
  add column if not exists video_url text;

alter table questions
  add column if not exists question_type text
    check (question_type in ('mcq', 'multi', 'true_false', 'num', 'text')),
  add column if not exists accepted_answers jsonb,
  add column if not exists tolerance numeric;

-- Locked down like every other table -- no policies yet.
alter table slides enable row level security;
