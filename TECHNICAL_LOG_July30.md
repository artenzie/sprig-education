# Technical log — 30 July 2026

## What we did today

Loaded Tier 2 — Application — into the database: 5 topics, 20 subtopics, 76
slides, 84 questions, verified end-to-end in a browser against real Supabase
data. The interesting parts weren't the loading itself (same fixed-UUID
pattern as Tier 1) but four things that came with doing it at this scale: a
generator script written to avoid a class of bug that scales badly with
volume, a piece of the app that turned out to already be finished without
anyone building it today, a discrepancy caught by recounting rather than
trusting a summary line, and a real database write made by *testing* the
feature, which then needed cleaning up.

---

## 1. Writing the generator instead of writing the SQL

Tier 1's content was loaded by hand-writing SQL directly — reasonable at 91
slides and 84 questions when it's the first time and every escaping mistake
teaches you something. Tier 2 was the same order of magnitude, but by now the
failure mode was well understood and not worth re-risking: this is
teen-facing copy, which means contractions everywhere — *don't*, *isn't*,
*you're*, *they'd* — and every one of those apostrophes needs doubling to
survive as a SQL string literal (`'don''t'`). Miss one in 76 slides and 84
questions of hand-typed SQL and you get a syntax error at best, or — worse —
a string that closes early and quietly truncates everything after it.

So instead of typing the `insert` statements, a one-off Node script
(`scratch/build-tier2.mjs`, deleted once it had done its job — it's not part
of the app, it's a tool for building one file) held the content as plain JS
objects:

```js
function esc(s) {
  return String(s).replace(/'/g, "''");
}

mcq("What makes a cost \"fixed\"?", [...], 2, "Fixed means automatic...")
```

Writing `it''s` by hand is a habit you can slip on. Writing `it's` inside a
normal JS string and letting one function double every `'` before it ever
reaches a SQL file is not a habit — it's a rule enforced by code, and it
applies uniformly to all 84 rows the same way every time.

**Checking the output before trusting it, rather than after.** Generating
correct-looking SQL isn't the same as generating SQL Postgres will accept.
Before ever pasting anything, two mechanical checks ran against every
generated file:

1. Every `'...'::jsonb` blob (the `options` and `accepted_answers` arrays)
   was pulled out with a regex, had its escaped quotes un-escaped, and was
   run through `JSON.parse()`. A malformed array would throw here, on a
   laptop, in a fraction of a second — instead of failing as an opaque
   Postgres error later.
2. A tiny state-machine walked each file character by character, flipping
   an `inString` flag on every `'` *unless* it was immediately followed by a
   second `'` (an escaped quote, not a delimiter), and asserted the flag was
   `false` at end-of-file. If a file ends still "inside" a string, some
   quote somewhere wasn't escaped — mechanically provable, without reading
   4,000 characters of prose looking for the one broken apostrophe.

Both checks passed on all 5 files before any of them touched Supabase.

**The general lesson:** the fix for "I might mistype an escape sequence 84
times" isn't "be more careful 84 times" — it's write one function that can't
forget, and one script that checks its own output before a human ever has to.

---

## 2. The canopy that lit up without a single code change

The dashboard's journey tree has three canopy branches — Application,
Mathematics, Mastery — forking off the Tier 1 trunk. Before today, all three
were locked and inert, because Tiers 2–4 had no topics in the database at
all. The plan going in was to "wire the canopy nodes to real topic UUIDs."
Reading `JourneyTree.tsx` before writing anything showed that work was
already done — on 24 July, by design, for exactly this moment:

```ts
// Left canopy — Application (sampled evenly along branch centerline)
{ id: "l1", x: 761, y: 1483, chapter: "II.I", title: "Budgeting Basics",
  kind: "lesson", tier: 2, topicOrder: 1, side: "left" },
```

and the comment above the node list:

> `tier` + `topicOrder` are how a drawn node finds its real topic row. Every
> lesson node carries them, including the canopy ones that have no content
> authored yet — so when Tiers 2-4 get seeded, the tree lights up on its own
> with no change to this file.

The tree never hardcodes *whether* a node is unlocked — it looks up
`journey.topics` (fetched fresh from Supabase by `useJourney()`) by
`` `${tier}.${topicOrder}` `` and renders whatever status that row actually
has:

```ts
const topic = byPosition.get(`${n.tier}.${n.topicOrder}`);
return (
  <LessonMark
    status={topic?.status ?? "locked"}
    onOpen={topic && topic.status !== "locked" ? () => navigate(`/topic/${topic.id}`) : undefined}
  />
);
```

Before today, `byPosition` had no entry for `"2.1"` through `"2.5"` — those
lookups returned `undefined`, so every canopy node fell back to `"locked"`
with no `onOpen` handler. The moment Tier 2's five topics existed with
`tier = 2` and `"order"` 1 through 5, those same lookups started resolving
to real rows, with no deploy, no edit, no restart. Verified by loading the
dashboard after seeding: all five Application nodes rendered their correct
titles and (correctly) still showed locked, because this tree treats all
tiers as one continuous chain — more on that next.

**Why locked was still correct, and what that reveals about the unlock
rule.** `deriveJourney()` sorts *every* topic across all four tiers by
`(tier, order)` and walks them in one pass, carrying `previousTopicComplete`
forward between topics:

```ts
const ordered = [...rawTopics].sort((a, b) => a.tier - b.tier || a.order - b.order);
// ...
const isReachable = previousTopicComplete && hasContent;
```

That means Tier 2's first topic doesn't unlock when *it* is reached — it
unlocks only once Tier 1's fifth topic is complete, because
`previousTopicComplete` is threaded straight through the tier boundary. The
three canopy branches look like three parallel paths in the artwork, but the
unlock logic underneath is a single sequential chain, trunk into canopy, with
no fork in the *data*. That's a real design detail worth knowing before
building Mathematics or Mastery: unlocking any of them still runs through
finishing Essentials first, not "pick a branch whenever."

The `hasContent` guard in the same function is what stopped this from going
wrong in every session for the last six days: a topic with zero subtopics is
explicitly *not* treated as complete (`completedCount === subtopics.length`
is vacuously true for an empty topic, which is exactly the bug this guard
exists to prevent), so Tiers 2–4 sitting empty since 24 July never
accidentally unlocked anything or inflated the progress percentage.

**The general lesson:** building an extension point *before* you have
anything to plug into it is what makes the extension free later. The 24
July session didn't wire the canopy for Tier 2 specifically — it wired it
for "whatever tier gets seeded next," and today's session is the proof that
worked.

---

## 3. Recounting the master copy's own numbers before loading them

The slide content's header claimed: *"5 topics · 20 subtopics · 82 slides."*
Before building the generator's data, each subtopic's slides were counted
directly from the actual pasted content — not the header, the real slide-by-
slide text:

```
II.I   4 + 4 + 4 + 1  = 13
II.II  5 + 4 + 4 + 2  = 15
II.III 4 + 4 + 4 + 4  = 16
II.IV  4 + 4 + 4 + 3  = 15
II.V   4 + 4 + 4 + 5  = 17
                       ----
                        76
```

76, not 82. Six slides short of what the document's own banner promised.

The question bank came with its own totals table, which gave an independent
way to sanity-check the *counting method itself* before deciding whether the
slide gap was real: 17 + 16 + 17 + 16 + 18 = 84 questions, and counting
questions per subtopic from the actual bank text landed on exactly that —
84, matching to the row. So the method wasn't the problem; the slide count
really was 6 short of the header's claim.

Nothing was invented to fill the gap, and nothing was silently trusted
either — the discrepancy was reported directly rather than assumed away in
either direction (`the header must be wrong` / `six slides must be
missing from what I was given`). Both are possible; only a look at the
original source material upstream of the paste can say which. What could be
verified — that the counting was done correctly and consistently against
both artifacts — was verified, and the answer to "which artifact is stale"
was left as an open question rather than a guess.

**The general lesson:** a document's summary line is a claim written by
whoever compiled the document, not a property of the content underneath it.
When the recount is cheap (and counting slide headings in a pasted document
is about as cheap as a check gets), do the recount before loading data based
on the summary — especially when the alternative failure is invisible: a
short slide count doesn't error, it just quietly under-teaches.

---

## 4. A paste that failed loudly, and why that was the safe outcome

Splitting Tier 1's 67KB single-paste incident (24 July) into smaller,
topic-sized files was meant to avoid a repeat. It mostly did — four of the
five files pasted clean on the first try. The fifth still hit a corrupted
paste, just a different flavour of the same underlying problem:

```
ERROR: 42601: syntax error at or near "("
LINE 12:   ('dd8115f0-...', '89c2a41', 'What BNPL Actually Is', 1),
```

`'89c2a41'` is the tail end of `'4c5646c9-4155-4d60-b151-40d2a89c2a41'` — a
chunk of the UUID, and the quote that should have opened it, vanished
somewhere between the chat window and the SQL Editor's text buffer.

**Why this was safe to just retry, not something to panic about.** `42601`
is a *syntax* error — Postgres never got far enough to understand what the
statement meant, which means it never got far enough to run any of it
either. When you paste several `insert` statements as one submission,
Postgres parses the *entire* text into a query plan before executing
anything; a parse failure partway through means nothing before or after that
point executed. This is a meaningfully different situation from a paste
that's syntactically valid but semantically wrong (say, a truncated string
that still happens to close correctly) — that kind *would* half-commit, and
would be much harder to notice.

**The fix:** rather than retry the same ~16KB paste and hope the clipboard
behaved better the second time, the file was split again — topic + subtopics
as one paste, slides + questions as a second — shrinking what any single
corruption could take out. Both halves ran clean.

**The general lesson:** a loud, immediate syntax error on a multi-statement
paste is close to the best-case failure — the database refused the whole
thing cleanly, and the fix is "make the unit smaller," not "audit what
already landed." The failure worth actually worrying about is the quiet one:
a paste that's still syntactically valid after corruption. Nothing here ruled
that out in general — it's exactly why every generated file gets checked
against `JSON.parse` and the quote-balance walk *before* it's pasted, rather
than trusting a clean-looking editor run to mean the content was right.

---

## 5. Verifying by using the feature writes real data — and needs real cleanup

Confirming Tier 2 actually worked meant more than checking rows exist in
Supabase — it meant signing in as a real student and clicking through an
actual lesson: slides with `£` and em dashes rendering correctly, an MCQ, a
`multi`, and a `true_false`-as-`mcq` question all grading correctly, and the
completion screen appearing after the last question.

Reaching a Tier 2 lesson at all required going around the lock deliberately,
by navigating straight to `/lesson?topic=...&subtopic=...` rather than
clicking through the dashboard — the signed-in test account hadn't finished
Tier 1, so Tier 2 was still (correctly) locked in the UI. That this was
*possible* is itself worth knowing: `Lesson.tsx` fetches by whatever
`topic`/`subtopic` ids are in the URL, with no check against the student's
actual unlock status. The lock is a UX device drawn by `deriveJourney()`,
not a security boundary — the same distinction this project has already
drawn for RLS (`RequireTeacher.tsx`'s redirect "would make the app rude, not
insecure," 27 July log). The real boundary here is the one that already
exists on `progress`: `auth.uid() = student_id` on every row, checked by
Postgres, not by which link the student happened to click.

**The side effect.** Reaching the last question and pressing Continue calls
`markSubtopicComplete()`:

```ts
await supabase.from("progress").upsert(
  { student_id: studentId, subtopic_id: subtopicId, status: "complete", ... },
  { onConflict: "student_id,subtopic_id", ignoreDuplicates: true },
);
```

That's a real write, keyed to whichever student is actually signed in. Test-
driving the feature as a real logged-in account — Restless Otter — really
did mark subtopic II.I.I complete on that account, ahead of it being reached
organically. Not a bug; exactly the behaviour that made the feature worth
testing this way. But it's a change to real progress data made *by testing*,
which is worth surfacing rather than leaving unmentioned, and it was cleaned
up rather than left in place:

```sql
delete from progress
where subtopic_id = 'd2862cbf-5c1d-4522-9b15-88f74c9f9704'
  and student_id = (select id from students where nickname = 'Restless Otter');
```

Scoped to exactly the one row this session created — the subtopic id pins
it to the specific lesson, and the nickname subquery pins it to the specific
account, so there's no way this statement could touch a different student's
progress even if run against the wrong environment by mistake.

**The general lesson:** verifying a feature by actually using it as a real
signed-in user is the only way to know it *works*, as opposed to knowing the
code *type-checks* — but "actually using it" on a real account means real
writes. Decide before you start whether that's disposable (a throwaway test
account) or needs reverting, and if it needs reverting, write the cleanup
as narrowly scoped as the thing that needed cleaning.

---

## What was verified

| Check | Result |
|---|---|
| All 5 files' jsonb blobs parse as valid JSON | ✅ before pasting |
| All 5 files' quotes balance (never end "inside" a string) | ✅ before pasting |
| Question counts per topic match the bank's own totals table | ✅ 17/16/17/16/18 = 84 |
| Slide counts per subtopic, recounted from source | 76 (header claimed 82 — flagged) |
| Library page lists all 5 Application topics, correctly titled | ✅ |
| Dashboard canopy resolves real topic UUIDs, no code changed | ✅ |
| Locked state correct for an account with 0 Tier 1 progress | ✅ |
| Direct URL into a Tier 2 lesson (bypassing the UI lock) | ✅ renders |
| Slide rendering — heading, body, `£`, em dashes | ✅ |
| MCQ grading + explanation | ✅ correct on first try |
| `true_false`-as-`mcq` (2-option) grading | ✅ |
| Lesson completion screen after last question | ✅ |
| Progress row written by the walkthrough | ✅ found, and deleted |
| Migration paste, file 4 (first attempt) | ❌ corrupted UUID mid-paste |
| Migration paste, file 4, split into two smaller pastes | ✅ |

**Not done, and deliberately:** Tiers 3 (Mathematics) and 4 (Mastery) are
still empty. Their canopy branches will light up in the tree the same way
Tier 2's did, the moment their topics exist — no further code work needed
for that part, only content.
