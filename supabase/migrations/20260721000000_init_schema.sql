-- Sprig initial schema (draft)
-- All tables have Row Level Security enabled with NO policies yet,
-- meaning every table is fully locked down: no anon/authenticated
-- client can read or write until policies are added later.

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null, -- hashed, never plain text
  school_name text
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  pin text not null, -- hashed, never plain text
  teacher_id uuid references teachers(id),
  current_tier int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  tier int not null check (tier between 1 and 4),
  "order" int not null,
  title text not null
);

create table if not exists subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id),
  title text not null,
  "order" int not null
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references subtopics(id),
  tier int not null check (tier between 1 and 4),
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text
);

-- No natural single-column key was specified, so student_id + subtopic_id
-- together form the primary key (one progress row per student per subtopic).
create table if not exists progress (
  student_id uuid not null references students(id),
  subtopic_id uuid not null references subtopics(id),
  status text not null default 'locked' check (status in ('locked', 'available', 'complete')),
  completed_at timestamptz,
  primary key (student_id, subtopic_id)
);

-- Added an id here since a student can have many attempts of the same
-- test_type over time, so there's no natural unique key to use instead.
create table if not exists test_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  test_type text not null check (test_type in ('baseline', 'progress_check', 'growth_check')),
  score numeric not null,
  date timestamptz not null default now(),
  questions_shown jsonb,
  answers jsonb
);

create table if not exists daily_checkins (
  student_id uuid not null references students(id),
  date date not null,
  mood text not null,
  primary key (student_id, date)
);

create table if not exists weekly_checkins (
  student_id uuid not null references students(id),
  week date not null, -- start date of the week
  confidence int,
  completion int,
  confused_by text,
  liked_most text,
  primary key (student_id, week)
);

-- Lock every table down by default. No policies are created here on
-- purpose -- add them explicitly, table by table, once auth is wired up.
alter table teachers enable row level security;
alter table students enable row level security;
alter table topics enable row level security;
alter table subtopics enable row level security;
alter table questions enable row level security;
alter table progress enable row level security;
alter table test_attempts enable row level security;
alter table daily_checkins enable row level security;
alter table weekly_checkins enable row level security;
