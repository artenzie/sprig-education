# Sprig: a field guide to money

A free, anonymous financial literacy platform for younger teenagers.
Live at **https://sprig.education**

Built by Artem Makarov, a Year 12 student, after seeing the same gap in every
school system he'd studied in: nobody teaches how money works.

**Status:** live, preparing a small pilot. Not yet used in schools.

## What it is
- Four tiers of short lessons (Essentials, Application, Mathematics, Mastery),
  20 topics, ~80 subtopics, 336 quiz questions
- Baseline, Progress Check and Growth Check tests to measure improvement
- Students log in with a nickname and PIN only, so no real names or emails
- Teacher dashboards for class progress; a host dashboard for cohort analytics

## Stack
React 19, TypeScript, Vite, Tailwind v4, Supabase (Postgres, Auth, RLS), Vercel

## Security design
- PINs are bcrypt-hashed; five failed attempts lock an account for 15 minutes
- Row-level security on every student-data table. Students read only their own
  rows; teachers see only their own class; no teacher can read scores or check-ins
- The host role is additive RLS policies plus a boolean flag, so no existing
  teacher policy was edited to grant it
- `scripts/check-rls.ts` re-verifies these boundaries by signing in as each
  role through the public API, not the service key

## Engineering notes
`TECHNICAL_LOG_*.md` records the build day by day: bugs, root causes, and what
each one taught. Start with the 20 August log.

## Licence
All rights reserved. The code is public to read, not to reuse. See LICENSE.

## Contact
hello@sprig.education
