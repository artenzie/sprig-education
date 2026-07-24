# Sprig — Technical Log: July 24, 2026

## What we did today

Three connected pieces of work: building the question-type components the app needed, extending the database schema to support them, and then loading all of Tier 1's real content (5 topics, 20 subtopics, 91 slides, 84 questions) so the Lesson flow runs on real data instead of one hardcoded mock question.

---

## 1. Built the three missing question types

The Lesson flow had one question type: multiple-choice (MCQ), with a hardcoded set of selectable rows. Real content needed four more shapes: **MULTI** (select several correct answers), **NUM** (type a number, checked against an exact value or a tolerance range), and **TEXT** (type a word/phrase, matched case-insensitively against a list of accepted answers).

**What we built:** `src/components/sprig/QuestionCard.tsx` — a single component that takes a `question` object with a `question_type` field and renders the right input automatically, while reusing the exact same header, submit button, and row styling as the original MCQ design. Internally:
- `mcq`/`multi` share the same selectable-row UI — the only difference is whether clicking a row replaces the selection (`mcq`) or toggles it in a `Set` (`multi`)
- `num`/`text` are just a styled `<input>`, with the correctness check happening on submit rather than as you type

This is a good example of a **discriminated union type** in TypeScript: `Question` is `McqQuestion | MultiQuestion | NumQuestion | TextQuestion`, each with a `question_type` literal tag. Because every variant shares that tag, TypeScript can narrow which fields are valid based on a single `if (question.question_type === "mcq")` check — you get autocomplete for `correctIndex` in the mcq branch and a compile error if you try to access it in the `num` branch.

---

## 2. Extended the database schema

Two migrations added what the real content needed beyond the original 9-table schema:

- **`slides` table** — `subtopic_id`, `order`, `heading`, `body`. Previously slide content for a lesson was hardcoded in the React component; now it's rows in a table, one per subtopic.
- **`topics.video_url`** — nullable, still unset (no videos exist yet).
- **`questions` table gained** `question_type`, `accepted_answers` (jsonb, for TEXT), and `tolerance` (numeric, for NUM ranges).
- **`questions.order`** — added later, once we discovered a subtopic's questions need a defined sequence (Q1, Q2, Q3...) and nothing in the original schema guaranteed one. Postgres doesn't promise any particular row order unless you sort by something explicit.

**RLS note, and a real bug we hit:** every table has Row Level Security enabled with zero policies, meaning the app is normally locked out of everything by default — that's intentional (see the July 21 log). Curriculum content (topics/subtopics/slides/questions) isn't student data though, so we added `select`-only RLS policies for those four tables. That alone wasn't enough: Postgres has **two separate layers** of access control — a base `GRANT` (does this database role have any permission on this table at all?) and RLS policies (which *rows* can it see?). We'd added the second without the first, so every request failed with `permission denied for table topics` — a real privilege error, not RLS silently returning zero rows. Fixed with an explicit `grant select on topics, subtopics, slides, questions to anon, authenticated;`. Worth remembering: RLS policies are meaningless until the role has table-level access to begin with.

---

## 3. Loaded all of Tier 1's real content

All 5 topics' worth of provided lesson content (Psychology of Spending, Where Money Really Comes From, Making Money Decisions, How Banks Work, Setting a Goal) went in as SQL migrations — 91 slides and 84 questions in total, with `question_type` set per question and `accepted_answers`/`tolerance` filled in where relevant.

A couple of real content-mapping decisions worth knowing about:
- **True/false questions** aren't a distinct UI component — they're stored as `mcq` with options `["True", "False"]`, since that's exactly what a T/F question is mechanically. Building a whole separate component for a 2-option MCQ wasn't worth it.
- **One "put these in order" question** got converted to a 4-option MCQ (pick the correct ordering from four choices) rather than building drag-to-reorder for a single question anywhere in the curriculum.
- Some source slides used markdown formatting (bullet lists, a table, a blockquote) that the slide renderer can't display — it renders one plain paragraph per slide. Those got rewritten as flowing prose, preserving every point, matching the style the first topic's slides already used.

**A debugging detour worth understanding:** pasting a ~67KB migration into Supabase's SQL Editor kept failing with syntax errors, but the file verified as byte-for-byte correct every time we checked it. The fix was to actually **parse the SQL with the real Postgres parser** (a package called `libpg-query`, which compiles Postgres's own C parser to run outside a database) rather than trusting a copy in a chat window — that confirmed the file was valid both times, meaning the corruption was happening in the copy/paste step itself, not the file. The practical fix was splitting the single giant statement into 10 small, independently-valid files (one per topic/table), so a paste failure is now isolated to a ~20-line chunk instead of a 200-line one. The broader lesson: when something "impossible" happens, verify with the same tool that will actually run it, not a proxy for it.

---

## 4. Rewired the Lesson page to run on real data

`Lesson.tsx` went from a fixed sequence (video → 2 slides → 1 question → feedback) to a **flat step list** built dynamically from whatever topic is loaded: one video, then for each of that topic's subtopics — its slides, a "ready" screen, then its questions in order. The whole lesson is just a pointer moving through this list, which is what let one component handle topics with wildly different shapes (3–5 subtopics, 3–5 questions each) without hardcoding anything per-topic.

Since there's no dashboard-to-lesson routing yet, `/lesson` defaults to Topic I.I but accepts `?topic=<uuid>` to preview any of the 5 topics — a temporary hook for testing that'll go away once the dashboard links directly to a chosen topic.

**Verification approach:** rather than eyeballing screenshots, we scripted a full click-through using Playwright — answering every question correctly by matching against the known correct answers, and asserting the feedback said "Correct" every time. This caught a real bug in the *test script* itself (a click-target string that accidentally matched text in the question prompt instead of an answer option) rather than the app, which was a useful reminder that automated tests can have their own bugs.

---

## What's next

Same as before: authentication (nickname + PIN login, RLS policies for the student-specific tables) is the next major piece of work. Once that exists, the dashboard can link directly into a specific topic instead of the `?topic=` override, and progress/test_attempts can start recording real data.
