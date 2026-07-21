# Sprig — Technical Log: July 21, 2026

## What we did today

Two different kinds of work today: backend infrastructure (Supabase) and content writing (check-in questions, video scripts). No UI/design work today — that phase is done.

---

## 1. Connected Supabase (the database)

**What Supabase actually is:** it's a "backend as a service" — instead of building and hosting your own server and database from scratch, Supabase gives you a real PostgreSQL database, an auto-generated API to talk to it, and authentication tools, all managed for you. Our React app talks to Supabase over the internet using a URL and a key, the same way a browser talks to any website.

**What we built:**
- Installed `@supabase/supabase-js` — the official library that lets JavaScript/React code talk to Supabase
- Created `src/lib/supabase.ts` — a small file that sets up one shared connection ("client") to our Supabase project, which the rest of the app can import and reuse rather than reconnecting every time
- Stored our real credentials (Project URL + publishable key) in a `.env` file — a special file for secrets/config that stays out of GitHub (`.gitignore` excludes it), while `.env.example` (a placeholder version with no real values) stays tracked, so anyone looking at the repo knows what environment variables are needed without seeing the actual secrets

**Database schema — the actual tables:**
We wrote a SQL migration file (`supabase/migrations/20260721000000_init_schema.sql`) that creates 9 tables:
- `teachers` and `students` — the two types of accounts
- `topics` and `subtopics` — the curriculum structure (Tier 1-4, each topic's subtopics)
- `questions` — the shared question bank every test pulls from
- `progress` — tracks which subtopics each student has completed
- `test_attempts` — logs every baseline/progress-check/growth-check attempt with its score
- `daily_checkins` and `weekly_checkins` — the mood and reflection data

A "migration" is just a script that describes a change to the database structure — running it once creates all these tables. We ran it manually through Supabase's SQL Editor (copy-pasted the script, clicked Run) rather than giving Claude Code direct database credentials, which keeps our actual database password out of the AI tool entirely — a reasonable security boundary.

**Row Level Security (RLS):** every table has RLS turned on, with zero access policies written yet. This means the database currently rejects every single read and write from the app — verified live, we got a `42501 permission denied` error on a test query, which is actually the correct, secure result. RLS is Postgres's built-in mechanism for controlling exactly which rows a given user is allowed to see or change (e.g. eventually: a student can only read their own progress row, not every student's). Building those specific policies is a task for the authentication session, not today.

---

## 2. Drafted weekly check-in and completion survey questions

Not a coding task — pure content writing, saved as reference docs for whenever the check-in UI gets wired to real logic.

- **Weekly check-in:** confidence (1-5), completion (yes/some/no), two optional free-text questions (what confused you, what was useful), plus two lower-frequency questions (missing topics, recommend score) shown every few weeks instead of every week, to avoid survey fatigue.
- **Pre-certificate survey:** a longer, one-time reflection shown right before a student claims their certificate — overall experience, confidence growth, free-text reflection, and critically, a testimonial permission question ("can we share your feedback anonymously?") — this is the actual mechanism for hitting the project's goal of 20+ detailed student reviews, without ever collecting a real name.

---

## 3. Rewrote the Tier 1 video scripts

The video scripts from the very first planning session (early July) were written against an outdated Tier 1 topic list, before the curriculum got reworked. Caught this before treating them as ready. Rewrote all 5 scripts to match the current Tier 1 topics exactly: The Psychology of Spending, Where Money Really Comes From, Making Money Decisions With What You Have, How Banks and Money Actually Work, Setting a Goal That Actually Matters to You. One video per topic (not per subtopic) — the video gives a topic-level overview, and slides go deeper into each of the 4 subtopics individually afterward.

---

## What's next
Authentication is the next Claude Code session — building nickname + PIN login (a custom flow, since Supabase's built-in auth doesn't natively support this pattern), the first-time PIN change step, and writing the actual RLS policies so logged-in students can read/write only their own data. Expected to be a full, focused session rather than something squeezed alongside other work.
