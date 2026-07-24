# Sprig — Technical Log: July 24, 2026

## What we did today

Three connected pieces of work: building the question-type components the app needed, extending the database schema to support them, and then loading all of Tier 1's real content (5 topics, 20 subtopics, 91 slides, 84 questions) so the Lesson flow runs on real data instead of one hardcoded mock question. Loading that content turned into a real debugging story, covered in detail below.

---

## 1. Built the three missing question types

The Lesson flow had one question type: multiple-choice (MCQ), with a hardcoded set of selectable rows. Real content needed three more shapes: **MULTI** (select several correct answers), **NUM** (type a number, checked against an exact value or a tolerance range), and **TEXT** (type a word/phrase, matched case-insensitively against a list of accepted answers).

**What we built:** `src/components/sprig/QuestionCard.tsx` — a single component that takes a `question` object with a `question_type` field and renders the right input automatically, while reusing the exact same header, submit button, and row styling as the original MCQ design. Internally:
- `mcq`/`multi` share the same selectable-row UI — the only difference is whether clicking a row replaces the selection (`mcq`) or toggles it in a `Set` (`multi`)
- `num`/`text` are just a styled `<input>`, with the correctness check happening on submit rather than as you type

This is a good example of a **discriminated union type** in TypeScript: `Question` is `McqQuestion | MultiQuestion | NumQuestion | TextQuestion`, each with a `question_type` literal tag. Because every variant shares that tag, TypeScript can narrow which fields are valid based on a single `if (question.question_type === "mcq")` check — you get autocomplete for `correctIndex` in the mcq branch and a compile error if you try to access it in the `num` branch.

`Lesson.tsx` was also rewired around this: it now fetches a topic's full content from Supabase and walks a **flat step list** built dynamically (video → each subtopic's slides → a "ready" screen → that subtopic's questions, repeated per subtopic) instead of a fixed video → 2 slides → 1 question sequence. That's what lets one component handle topics with different numbers of subtopics and questions without hardcoding anything per-topic.

---

## 2. Extended the database schema

Three migrations added what the real content needed beyond the original 9-table schema:

- **`slides` table** — `subtopic_id`, `order`, `heading`, `body`. Slide content used to be hardcoded in the React component; now it's rows in a table, one per subtopic.
- **`topics.video_url`** — nullable, still unset (no videos exist yet).
- **`questions` table gained** `question_type`, `accepted_answers` (jsonb, for TEXT), `tolerance` (numeric, for NUM ranges), and later `order` — added once we realized a subtopic's questions need a defined sequence (Q1, Q2, Q3...) and nothing in the original schema guaranteed one. Postgres doesn't promise any particular row order unless you sort by something explicit.

**A real RLS bug:** every table has Row Level Security enabled with zero policies, so the app is normally locked out of everything by default (intentional — see the July 21 log). Curriculum content isn't student data, so we added `select`-only RLS policies for `topics`/`subtopics`/`slides`/`questions`. That alone wasn't enough — Postgres has **two separate layers** of access control: a base `GRANT` (does this role have any permission on this table at all?) and RLS policies (which *rows* can it see?). We'd added the second without the first, so every request failed with `permission denied for table topics` — a genuine privilege error, not RLS silently returning zero rows. Fixed with an explicit `grant select on topics, subtopics, slides, questions to anon, authenticated;`.

---

## 3. Loading the content — and the SQL paste-corruption saga

All 5 topics' worth of provided lesson content (Psychology of Spending, Where Money Really Comes From, Making Money Decisions, How Banks Work, Setting a Goal) went in as SQL migrations — 91 slides and 84 questions, with `question_type` set per question and `accepted_answers`/`tolerance` filled in where relevant. Two content-mapping calls worth knowing about: true/false questions are stored as `mcq` with options `["True", "False"]` rather than as their own UI type (a T/F question *is* a 2-option MCQ), and the one "put these in order" question became a 4-option MCQ (pick the correct ordering) rather than building drag-to-reorder for a single question.

That part was routine. Getting it into the database was not.

**Attempt 1.** The first migration for topics I.II–I.V was one big file — a single `insert into slides ... values (...), (...), ...;` and a single `insert into questions ...` with dozens of rows each, about 67KB of text. Pasted into Supabase's SQL Editor, it failed:

```
42601: trailing junk after numeric literal at or near '87564f3d'
```

That error is Postgres's way of saying "I was not inside a quoted string when I hit this token, and it starts with digits, so I tried to read it as a number — then choked on the letters after." The only way that happens to a UUID like `'87564f3d-...'` is if the **opening quote before it is missing**. So the working theory was: a single `'` character got dropped somewhere before that point in the file, most likely during copy/paste out of the chat.

**Checking the file, not the theory.** Before touching anything, we verified the actual file on disk rather than assuming the theory was right:
- Read the raw bytes around that exact string with a hex-safe dump — the quote was there, correctly placed, no invisible characters.
- Wrote a quick script to count single quotes per SQL statement and confirm each statement had an even number (i.e., every opening quote had a matching close) — all balanced.

Both checks passed, which was suspicious on its own — if the *file* was fine, the corruption had to be happening somewhere between the file and Postgres actually parsing it.

**Getting a real answer instead of a better guess.** Byte-checking and quote-balancing are both heuristics — they can miss things a real SQL parser wouldn't. So we installed `libpg-query`, an npm package that compiles **Postgres's actual C parser** to run standalone (no database connection needed — it's the literal code Postgres itself uses to turn SQL text into a query plan). Running the file through it:

```
PARSE OK, statements: 4
```

That's a materially stronger claim than "looks fine" — it's the same code path Supabase would run, saying the file was valid. Combined with the clean byte/quote checks, this ruled out the file itself and pointed squarely at the copy/paste step: something about pulling 67KB of text out of a chat window and into the SQL Editor was dropping or altering a character.

**Attempt 2.** As a mitigation (not knowing exactly what in the paste path was misbehaving, only that shorter pastes are less exposed to it), the single giant `insert` statements were split into one `insert` per topic — 10 statements instead of 4, each independently re-verified with `libpg-query`. This didn't fix the root cause, but it shrank the blast radius: if a paste corrupts a statement, you now lose ~20 lines instead of ~200, and can retry just that piece.

The second attempt *also* failed — a different error, at a different line (`syntax error near "insert"` at the boundary between two statements this time). Different failure location, same signature: the file re-verified clean against `libpg-query` immediately after. This confirmed it definitively wasn't one specific fragile character or line — the corruption was non-deterministic per paste, consistent with something in the copy path itself (browser clipboard handling, or the SQL Editor's own text input) rather than a bug in the SQL.

**The actual fix.** Rather than keep debugging an environment we couldn't directly inspect, we wrote each of the 10 statements to its own small standalone file (1–10KB each) and had them copied and run one at a time, directly from file to SQL Editor with no intermediate chat step. All 10 ran successfully.

**Why this mattered as a debugging exercise:** the instinct when a paste "fails" is to distrust the content you generated. The useful move was to verify the content with the strongest tool available — not eyeballing it, not a hand-rolled heuristic, but the actual parser that would eventually run it — before spending any time editing content that was never the problem. Once that ruled out the file, the only remaining variable was the transport, and the fix followed directly: make each unit small enough that a corrupted paste is cheap to notice and retry.

---

## 4. Verifying it actually works

Rather than eyeballing screenshots, we scripted full click-throughs of the lesson flow with Playwright — launching the dev server, navigating to a topic, and answering every question correctly by matching against the known correct answers, asserting the feedback said "Correct" each time and that the flow reached the completion screen with zero console errors. This caught one real bug — not in the app, but in the *test script* itself, where a click-target string accidentally matched text inside the question prompt instead of the intended answer option. Useful reminder that automated verification scripts can have their own bugs, which is part of why re-running and cross-checking mattered.

---

## What's next

Same as before: authentication (nickname + PIN login, RLS policies for the student-specific tables) is the next major piece of work. Once that exists, the dashboard can link directly into a specific topic instead of today's `?topic=<uuid>` override on `/lesson`, and progress/test_attempts can start recording real data.
