# Sprig — Technical Log: July 24, 2026

## What we did today

Two sessions today. First: building the question-type components the app needed, extending the database schema to support them, and then loading all of Tier 1's real content (5 topics, 20 subtopics, 91 slides, 84 questions) so the Lesson flow runs on real data instead of one hardcoded mock question — that content load turned into a real debugging story, covered in detail below. Second: porting the Topic screen from the Lovable prototype and wiring the previously-disconnected pieces together — dashboard tree → Topic screen → Lesson flow — into one working chain, tested live end-to-end in a browser.

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

## 5. Ported the Topic screen and wired real navigation

The dashboard's tree and the Lesson flow existed, but there was nothing between them — clicking a node on the tree did nothing, and the only way into a lesson was a hand-typed `?topic=<uuid>` in the URL. This session built the missing middle screen and connected the whole chain.

**Ported `/topic` from the Lovable prototype.** The other repo (synced from Lovable) had a `/topic` route with the right visual design — title, description, video placeholder, and a list of subtopics with status indicators — but everything on it was hardcoded mock data (`const TOPIC = {...}`, `const SUBTOPICS = [...]`), and its subtopic links all pointed at a single generic `/lesson` with no way to say *which* subtopic. Porting it meant keeping the layout and componentry but rebuilding the data layer: `src/pages/Topic.tsx` now takes a `topicId` route param, fetches that topic and its subtopics from Supabase (`topics` joined with `subtopics(*)`), and renders from the real rows.

**Added a `description` column.** The Lovable design showed a blurb under the topic title, but the `topics` table only had a `title` — that copy lived nowhere real. Rather than fake it in the component, a small migration (`20260724040000_add_topic_description.sql`) added a nullable `description` column and backfilled the 5 Tier 1 topics with short blurbs written from their actual subtopic content (one topic's blurb — Psychology of Spending — turned out to match the Lovable mock almost exactly, since both were describing the same real subtopics). The component renders the blurb only `if (topic.description)`, so a topic without one yet just omits that paragraph instead of showing a placeholder.

**No fake progress.** The Lovable mock showed subtopics as complete/current/locked, backed by nothing. There's no login/session concept in the app yet (see "What's next" below), so there's no real per-student completion to show. Rather than invent fake checkmarks, `Topic.tsx` marks only the *first* subtopic as "Start here" (an honest suggestion, not a claim about progress) and renders the rest as plain, open, clickable rows.

**Wired the dashboard tree to real topic IDs.** `JourneyTree.tsx`'s node data (`t1`..`t5` for the trunk) was — and still is — hardcoded art: hand-placed SVG coordinates for a hand-drawn tree aren't something you want driven by a database row. But *which topic* each node opens shouldn't be hardcoded. So `JourneyTree` now fetches `topics` where `tier = 1` on mount, matches each by `order` against a small `{ t1: 1, t2: 2, ... }` lookup, and passes the resolved UUID into each node's click handler, which calls `navigate(`/topic/${topicId}`)`. Canopy nodes (Tiers 2–4) have no seeded content yet, so they're left unmapped and stay locked/inert — clicking them still does nothing, same as before.

**Made the Lesson flow subtopic-aware.** `Lesson.tsx` always started at step 0 (the topic's intro video) no matter how you arrived. Clicking a specific subtopic row on the Topic screen needed to jump straight into *that* subtopic's first slide instead. The flow's steps are a flat array built by `buildSteps()` (video → subtopic 1's slides → ready → questions → subtopic 2's slides → ...), so this became: read a new `?subtopic=<uuid>` query param, look up that subtopic's index in the topic, and find the first step in the flat array whose `subtopicIndex` matches — that's the starting pointer. If no `subtopic` param is present (or it doesn't match), it falls back to step 0 as before, so the old `?topic=<uuid>`-only links still work unchanged.

**Closed the loop back to Topic.** The Lesson header's back link used to always go to `/dashboard`. It now goes to `/topic/${topic.id}` instead — so leaving a lesson mid-way returns you to the topic you came from, not all the way out to the tree.

The full chain now works end-to-end and was tested live in a browser (not just type-checked): dashboard → click "The Psychology of Spending" → lands on `/topic/b14567dc-...` with real subtopics from Supabase → click "Impulse Buys — Why They Happen" (subtopic 3 of 4) → lesson opens directly on that subtopic's first slide ("Part 3 of 4"), not the topic intro → back link returns to the same `/topic/b14567dc-...` screen. Console was clean throughout (no errors), and a click on a still-locked node (`Setting a Goal That Actually Matters to You`, Tier 1's 5th topic) correctly did nothing rather than navigating.

---

## 6. Scoping the step counter, and a real duplicate-data bug

Once subtopic deep-linking worked, a follow-up problem showed up: jumping into subtopic 3 of a 4-subtopic topic still counted steps against the *whole topic* — "18 of 39" instead of something like "1 of 9" for that subtopic on its own. `Lesson.tsx`'s step list was always built by `buildSteps()`, one flat array covering the topic's intro video plus every subtopic's slides/ready/questions back to back; jumping to subtopic 3 just moved the starting *pointer* partway into that shared array, so the denominator was still the full topic's step count.

**Fix:** added `buildSubtopicSteps(topic, subtopicIndex)`, which builds a step list containing *only* the target subtopic's own slides → ready → questions — no video, no other subtopics. When arriving via `?subtopic=<uuid>`, the Lesson flow now uses this scoped list instead of the full-topic one, so the counter is correctly relative to just that subtopic. A side effect worth noting: finishing a subtopic-scoped session no longer means the *topic* is done, so the completion screen and its "back" link were made conditional too — subtopic-scoped completions show that subtopic's title and return to `/topic/:id`; full-topic completions (no `subtopic` param) still show the topic's title and return to `/dashboard`, unchanged from before.

**Then a real bug turned up while verifying the fix.** Testing the scoped counter against Topic I.III surfaced slides repeating in sequence — 1, 1, 2, 2, 3, 4 instead of 1, 2, 3, 4. Rather than assume the new step-building code was at fault, this got checked against the actual data first: a script queried every subtopic's slides directly from Supabase and grouped them by `(subtopic_id, order)`. Result — **all 4 of Topic I.III's subtopics had every slide row duplicated in the database itself** (34 rows where 17 should exist), each duplicate pair byte-identical in `heading` and `body` but with a different `id`. The step-building code was working correctly; it was faithfully rendering two real rows per slide.

A full scan across all 5 topics and all 20 subtopics (not just I.III) confirmed the duplication was isolated to that one topic — Topics I.I, I.II, I.IV, I.V, and the entire `questions` table everywhere came back clean. The likely cause: `slides` inserts have no `on conflict` guard (no natural unique key was ever given to the table — see §2), so when the July 24 SQL-paste saga (§3) eventually got all 10 statements to run cleanly, it looks like one of I.III's earlier failed/retried attempts had actually landed in the database too, rather than truly failing.

**Fix:** a small migration (`20260724050000_dedupe_topic_I_III_slides.sql`) deletes the 17 specific duplicate rows by `id` — not a generic dedup query, since each id was individually verified content-identical to its surviving twin before being listed, and safe to re-run (a second run deletes zero rows). Deliberately didn't add a defensive dedup filter in the app code itself: silently coalescing duplicate rows client-side would have hidden this bug rather than fixed it, and would hide a future one where duplicated rows *aren't* identical.

Verified in two layers: a direct Supabase query confirmed each of I.III's subtopics now has exactly the right slide count (5, 4, 5, 3) with no gaps or repeats in the order sequence, and a live browser click-through of the worst-hit subtopic (10→5 rows) showed a clean 1→2→3→4→5 progression with no repeats.

---

## What's next

Authentication (nickname + PIN login, RLS policies for the student-specific tables) is the next major piece of work, and it unblocks two things directly: real per-subtopic completion status (replacing the "first subtopic = start here, rest = open" placeholder built this session) on the Topic screen, and the same for the dashboard tree's complete/current/locked states, which are still hand-set in `JourneyTree.tsx`'s data rather than read from anywhere. Tier 2–4 content also still doesn't exist, so the canopy branches of the tree stay locked with no topic to link to.
