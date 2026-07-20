# Sprig

## Project

Sprig is a free financial literacy web platform for younger teenagers, with UK-based content, built by a Year 12 student. A school pilot is planned for autumn 2026.

## Tech stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router v7
- Supabase — auth + database, **not yet connected**
- Vercel — deployment target, **not yet deployed**

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

## Pages built (as of July 20, 2026 session)

Landing (root), Login, Dashboard (journey tree), Lesson flow, Progress/Tests, Certificate, Library, FAQ — all static UI, ported from a Lovable-designed prototype. No backend functionality yet.

## Workflow preference

At the end of every session, generate a technical summary log as `TECHNICAL_LOG_[date].md`, explaining what was built and the key concepts involved. Write it to help a learning student actually understand the code — not just to document that the work happened.
