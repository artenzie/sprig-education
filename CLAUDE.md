# Sprig

## Project

Sprig is a free financial literacy web platform for younger teenagers, with UK-based content, built by a Year 12 student. A school pilot is planned for autumn 2026.

## Tech stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router v7
- Supabase — auth + database, **connected**
- Vercel — deployment target, **not yet deployed**

## Authentication

- Students sign in with **nickname + 6-digit PIN**, on Supabase's native email/password auth. The nickname is slugified into a synthetic address (`curious-squirrel@students.sprig.study`) that the student never sees; the PIN is the password verbatim. `src/lib/studentAuth.ts` is the single source of truth for that mapping.
- 6 digits, not 4, because Supabase's minimum password length is 6 and it's a project-wide setting.
- `students.id` **is** `auth.users.id`. Every RLS policy is therefore just `auth.uid() = student_id`.
- PINs are bcrypt-hashed and unreadable — a forgotten PIN is reset by a teacher, never looked up.
- Accounts start on PIN `000000` with `must_change_pin = true`, and `RequireAuth` blocks every route until it's changed.
- Accounts are created by `node --env-file=.env scripts/create-students.ts <count> --teacher <uuid>` (needs the service-role key, local only).
- **Required Supabase dashboard settings**: email confirmations OFF, new-user signups OFF, and the sign-in rate limit raised well above class size (a whole class shares one school IP).

## Teacher accounts

- Teachers sign in with a **real email + password** — no synthetic-address bridge, none of the student nickname machinery applies.
- `teachers.id` **is** `auth.users.id`, exactly as for students, so every teacher rule is `auth.uid() = teacher_id`.
- **There is no signup.** New-user signups are OFF project-wide, and the Login page's Teacher/Parent box is login-only by design. Accounts come from `node --env-file=.env scripts/create-teacher.ts <email> --school "..."`, which *generates* a 24-character password and prints it once. Run it **before** `create-students.ts --teacher <uuid>`.
- A teacher sees only their own students (`students.teacher_id = them`), via one RLS policy. They can do exactly two things, through security-definer functions that check ownership in the database: **clear a lockout** and **reset a PIN** to a random 6 digits shown once, which also forces `must_change_pin` back to true, clears the lockout and kills live sessions. Every action is logged to `teacher_actions`, capped at 40/hour.
- A teacher can also read their class's `progress` — completions only, via a second RLS policy scoped the same way (`students.teacher_id = auth.uid()`, joined through). `test_attempts` and the check-ins are still off-limits: no score, answer, or mood is visible to a teacher yet.
- `teacher_reset_pin()` writes a bcrypt hash straight into `auth.users` — the free-plan route. Its failure mode is silent (update succeeds, student still can't log in), so verify a reset by **actually signing in with the new PIN**, never by the function returning cleanly. The Edge Function upgrade path is noted in the migration.

## Design system

- **Fonts**: Fraunces (serif — headings/display), Manrope (body/UI)
- **Colors**: cream `#F6F5F0`, forest green `#3F7A5C`, light mint `#CDE8D4`, terracotta `#E07A3F`, dark text `#22291F`, muted text `#6B7268`, hairline borders `#E0DED4`
- **Feel**: calm, editorial, botanical — inspired by Notion, Linear, Apple HIG, premium editorial design
- **Avoid**: generic AI-design patterns — purple-blue gradients, bubble buttons, centered-everything layouts, card-grid overuse, cartoonish elements
- **Core visual metaphor**: a growing tree/plant represents student progress. The trunk is Tier 1 (Essentials); it forks into three canopy branches — Application, Mathematics, Mastery — for Tiers 2–4.

## Content structure

- 4 tiers, 5 topics per tier, 3–4 subtopics per topic
- Each subtopic: video → slides → questions → feedback, max 15 minutes
- Students are fully anonymous: random nickname + teacher-distributed PIN, no real names collected
- Two test types:
  - **Progress Check** — topic-based, retakeable, student picks which topics to be tested on
  - **Growth Check** — baseline-style, tracks overall improvement over time

## Pages built (as of July 25, 2026 session)

Landing (root), Login, Set PIN, Dashboard (journey tree), Topic, Lesson flow, Progress/Tests, Certificate, Library, FAQ, and **Teacher** (`/teacher`, behind `RequireTeacher` — the roster with Unlock and Reset PIN, each student's tier/completion, and a class-wide per-topic completion chart reusing `TopicBars`).

Working against the database: login/logout, the first-time PIN change, route guards, the curriculum reads on Topic and Lesson, and **real lesson progress** — finishing a subtopic's last question writes a `progress` row, which drives the dashboard bar, the journey tree's node states, and the Topic page's unlock chain.

How progress is stored: **only completions**. A row in `progress` means "this student finished this subtopic"; `locked` and `available` are derived on the client in `src/lib/journey.ts`, never written. Tiers 1–3 have content now (Tier 4 doesn't yet, so it stays locked) — `deriveJourney()` guards against treating a topic with zero subtopics as complete.

The Progress page draws on two tables that mean different things, and keeps them visibly separate rather than blending them into one "progress" number: `progress`-by-topic completion bars (did they finish it) feed the Progress Check topic-picker, and `test_attempts`-derived mastery bars + missed-question cards (how they actually did) live in `src/lib/testMastery.ts` — `latestOutcomes()` collapses a student's answer history into "as of their most recent attempt at each question," so mastery moves when a retake improves it rather than averaging in old attempts forever. The Growth Check line chart is real too, via `src/lib/testAttempts.ts` and `src/pages/TestFlow.tsx`, the baseline/Progress Check/Growth Check writer.

Still mock or absent: Certificate and Library. Streak and XP were removed rather than faked (`daily_checkins` has no writer; XP has no defined rule).

## Workflow preference

At the end of every session, generate a technical summary log as `TECHNICAL_LOG_[date].md`, explaining what was built and the key concepts involved. Write it to help a learning student actually understand the code — not just to document that the work happened.
