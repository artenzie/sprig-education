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
- Accounts are created by `node --env-file=.env scripts/create-students.ts <count>` (needs the service-role key, local only).
- **Required Supabase dashboard settings**: email confirmations OFF, new-user signups OFF, and the sign-in rate limit raised well above class size (a whole class shares one school IP).

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

Landing (root), Login, Set PIN, Dashboard (journey tree), Topic, Lesson flow, Progress/Tests, Certificate, Library, FAQ.

Working against the database: login/logout, the first-time PIN change, route guards, and the curriculum reads on Topic and Lesson. Still mock data: the dashboard's percentages and streaks, the journey tree's complete/current/locked states, Progress, Certificate and Library. Persisting real progress and test attempts is the next piece of work — the RLS policies for it are now in place.

## Workflow preference

At the end of every session, generate a technical summary log as `TECHNICAL_LOG_[date].md`, explaining what was built and the key concepts involved. Write it to help a learning student actually understand the code — not just to document that the work happened.
