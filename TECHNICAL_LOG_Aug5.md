# Technical log — 5 August 2026

## What we did today

Loaded Tier 3 — Mathematics — into the database: 5 topics, 20 subtopics, 70
slides, 86 questions, all verified against the source material's own counts
before touching Supabase, and spot-checked end-to-end in a real lesson (a
`text`, a `num`, and two `mcq` questions, all grading correctly). The bank
now holds 254 questions across all three loaded tiers. One change from how
Tier 1 and 2 were loaded: content went into the database directly through
`supabase-js`, not by pasting SQL into the dashboard's SQL Editor.

---

## 1. Skipping the paste step entirely, not just splitting it smaller

Tier 2's log (30 July) describes two different failure modes from pasting
generated SQL into Supabase's SQL Editor: a 67KB single paste that silently
corrupted mid-transfer, and a smaller topic-sized paste that still lost a
character out of a UUID. Both were caught — one by a loud syntax error, one
by the pre-paste validation checks — but both existed only because the path
from "correct data" to "rows in the database" ran through a browser textbox.

The project already had everything needed to skip that textbox: a
service-role key sitting in `.env`, used every day by `create-students.ts`
and `create-teacher.ts` to write directly to Supabase over `supabase-js`.
Today's content used the same path — a script held the 70 slides and 86
questions as plain JS objects, and called `.insert()` on `topics`,
`subtopics`, `slides`, and `questions` directly, in that order (subtopics
need their topic's id to exist first; questions need their subtopic's id).

```js
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await admin.from("topics").insert(rows.topics);
await admin.from("subtopics").insert(rows.subtopics);
await admin.from("slides").insert(rows.slides);
await admin.from("questions").insert(rows.questions);
```

`supabase-js` sends this as JSON over the REST API (PostgREST). JSON has its
own escaping rules, but they're handled by `JSON.stringify` — a function
that has never once forgotten to escape a quote — rather than by a human
remembering to double every apostrophe in seventy slides of teen-facing copy
full of *don't*, *isn't*, *you're*. The entire class of bug from the last two
sessions — a corrupted paste, a truncated string, a stray unescaped quote —
isn't fixed here. It's *impossible* here, because there's no text buffer in
the middle for corruption to happen to.

**Why the SQL migration files still exist.** `supabase/migrations/` is this
project's record of every piece of content that's ever been loaded, readable
without opening Supabase at all. That value doesn't depend on the SQL being
what *executed* — so the same generator that built the insert-ready JS
objects also rendered them out as five `.sql` files, one per topic, in the
exact format Tier 1 and 2 used. They're the historical record; the
`supabase-js` script is what actually ran. Both were validated before either
one was trusted: every `::jsonb` blob round-tripped through `JSON.parse`,
and every file was walked character-by-character confirming no unescaped
quote left it "inside a string" at the end — the same two checks Tier 2
introduced, run here as much for extra confidence as necessity, since a
JSON-based insert can't have a SQL-escaping bug in the first place.

**The general lesson:** the previous two sessions treated "the paste keeps
corrupting" as a problem to make smaller. It was actually a problem to make
*disappear* — the credentials to skip it entirely were already sitting in
the project's own `.env` file the whole time.

---

## 2. A banner that didn't even add up to itself

Tier 2's log describes catching a stale slide count by recounting against
the source document rather than trusting its own summary line. Today's
question bank had the same kind of claim — "52 MCQ · 5 MULTI · 22 NUM · 6
TEXT · 3 T/F" — and it failed a check even simpler than Tier 2's: those five
numbers add up to 88, and the bank says it contains 86 questions. The banner
was wrong before it was even compared against anything external.

Counting the actual `Q1 · TEXT`, `Q2 · NUM` tags in the source text (a
regex over every question header, not a manual tally) gave **47 MCQ, 3
MULTI, 27 NUM, 6 TEXT, 3 T/F — which sums to 86**, matching the bank's real
total and matching a question-by-question count of every subtopic. So the
content itself was right throughout; only the one-line summary at the
bottom was wrong, in three of its five numbers.

```
grep -oE '\*\*Q[0-9]+ · [A-Z/]+\*\*' bank.md | sed -E 's/.*· //' | sort | uniq -c
     47 MCQ
      3 MULTI
     27 NUM
      3 T/F
      6 TEXT
```

**Why this matters beyond one wrong banner.** A summary that doesn't even
sum to the stated total is a *self-detecting* error — you don't need the
source document at all to know something's off, just arithmetic. That's a
cheaper class of check than Tier 2's slide recount (which needed the
original text to catch), and it's worth running first: before recounting
against anything, check whether a document's own numbers agree with each
other.

**The general lesson:** the same discipline from 30 July — recount before
trusting a summary line — caught something today that a summary-vs-content
comparison wouldn't have needed to: the summary disagreed with *itself*.
Both checks are cheap. Neither should be skipped because the other looks
sufficient.

---

## 3. A heuristic that correctly flagged its own known blind spot

`check-questions.ts` (added 27 July, per its own doc comment) exists because
a numeric question with no numbers in it once reached a real baseline test.
Its rule 1 — a `num` question must contain a digit somewhere in its text —
caught something in today's content:

> **Inflation Basics → Why Things Cost More Over Time (question 1)**
> "What inflation rate, as a percentage, does the UK government set as the
> Bank of England's target?" — answer: `2`.

The question is entirely self-contained; it just doesn't happen to spell
its own answer's magnitude in digits anywhere in the question text. This is
exactly the false-positive shape the script's own comment already
anticipates and names — "*How many days are in a week?* is a legitimate
digit-free `num` question" — so it went into the `REVIEWED` allowlist
alongside the two entries already there, with a reason recorded rather than
just silenced:

```ts
"8689ed6b-b7dd-43c5-b8fe-cda1769b2648":
  'Legitimate digit-free NUM question ("What inflation rate ... does the
  UK government set as the Bank of England\'s target?", answer 2) — same
  class as "How many days are in a week?" from the rule\'s own doc
  comment. Fully self-contained; just has no digit in the question text.',
```

Running the check afterward also surfaced one pre-existing issue from Tier
2 (`466f91ed…`, the UK fraud-number question) that was never added to the
allowlist in the 30 July session. It's the identical false-positive shape,
but it belongs to content this session didn't write, so it was left
flagged rather than silently fixed — a decision that isn't this session's
to make on someone else's content without saying so.

**The general lesson:** a heuristic check that documents its own known
false-positive shape in advance is doing its job correctly when it flags
one — the fix is a recorded, reasoned allowlist entry, not a change to the
rule. Changing the rule to stop matching "no digits" would also stop it
from catching the next real bug of that exact shape.

---

## 4. Verifying via a real account again — and a browser that never cooperated long enough to finish

Same approach as 30 July: sign in as a real student and click through an
actual Tier 3 lesson rather than trusting that rows exist. Reaching one
required going around the lock the same way as before —
`/lesson?topic=...&subtopic=...` directly — since the test account
(**Restless Otter**, reused from the 30 July session) hadn't finished
enough of Tier 1 to have Tier 3 unlocked organically. Its PIN from the
earlier session wasn't recorded anywhere retrievable — PINs are bcrypt
hashes by design, per `studentAuth.ts` — so it was reset through
`supabase.auth.admin.updateUserById()` to a known value for this session,
the same mechanism `teacher_reset_pin()` uses internally.

This ended up taking two attempts, and neither one reached the actual
completion screen — not because of the content, but because of the browser
automation tooling itself.

**First attempt.** All 4 slides of *What a Percentage Actually Means*
rendered correctly (`£`, `÷`, `×`, em dashes all intact), then all 4
questions — a `text` question graded against `per hundred`, a `num`
question graded against `21`, and two `mcq` questions — each showed the
right explanation, ending on a "LESSON COMPLETE" label next to the final
question's feedback. Clicking that question's Continue button — the step
that would actually advance to the completion screen and write `progress`
— was the exact moment the tab's script-injection channel started timing
out on every subsequent command, including a renavigation to `/dashboard`.
Waiting and retrying didn't recover it.

**Second attempt**, in a fresh tab: logging back in and re-running the same
subtopic worked cleanly for questions 1 through 3 — `text` and `num` graded
correctly again, both confirmed through `get_page_text` rather than
screenshots once screenshot capture specifically started timing out
(`get_page_text` and `find` kept working past that point, so navigation
continued via those instead of visual confirmation). Then the same class of
failure recurred on question 4, this time not clearing after several
waits, across both open tabs. Checking the actual Chrome window directly
confirmed neither tab had reached the completion screen — both were still
sitting mid-lesson.

Both attempts were checked the way that didn't depend on any browser tab
at all — querying `progress` directly for Restless Otter's student id,
which came back empty every time it was checked. So the one question that
actually mattered — *did an incomplete run leave a stray write behind?* —
has a clean, tool-independent answer across both attempts: no.

**What was not directly observed this session.** The transition from the
last question's "Correct" screen to the actual lesson-complete screen (and
the `progress` write that happens there) was not seen render, in either
attempt — both times, the browser tooling stopped responding before or at
that exact step, not the content before it. `text`, `num`, and `mcq`
questions were each independently confirmed grading correctly twice over,
so the content itself is well-verified; it's specifically the one final
screen transition that stayed unobserved. Tier 2's version of this same
transition (30 July) was fully verified and hasn't changed, so this isn't
a new or suspect code path — but it's honest to record what was watched
happen directly and what wasn't, rather than letting "verified end to end"
quietly cover a step that wasn't.

**The general lesson:** when a verification tool fails once, retrying is
reasonable. When it fails the same way twice, across fresh tabs and
multiple waits, that's a signal about the tool rather than bad luck —
worth surfacing plainly and letting the person who can see the actual
browser window make the call, rather than continuing to retry against
something that keeps failing the same way.

---

## 5. Choosing the apply method before writing anything

Today started with a decision Tier 1 and 2 never had to make explicitly,
because they only had one available path: paste SQL by hand. With a working
`supabase-js` alternative sitting in the project already, there were
genuinely two reasonable ways to load this tier, and picking one silently
would have been a real workflow change made on the user's behalf without
them weighing in. So before writing any content, the choice itself —
generate-and-paste versus generate-and-insert-directly — was put to the
user as a question, with the trade-off stated plainly (no manual paste
step and no escaping-bug class, versus keeping the exact process that's
already been used twice). They picked the direct-insert path, which is
what today's sessions 1 through 4 describe.

**The general lesson:** a tool becoming available doesn't mean it should be
used silently in place of an established process, even when it's strictly
better on every axis that matters technically. Changing *how* content gets
into the database is a decision about the project's workflow, not just
about this session's content — worth one question, not an assumption.

---

## What was verified

| Check | Result |
|---|---|
| Slide count recounted from source, per subtopic | ✅ 70, matches banner |
| Question count recounted from source, per subtopic | ✅ 86, matches banner |
| Question format-spread banner (52/5/22/6/3) vs actual tags | ❌ banner wrong (doesn't even sum to 86); actual = 47 MCQ/3 MULTI/27 NUM/6 TEXT/3 T/F |
| Every NUM answer is a whole number | ✅ checked programmatically |
| Every generated SQL file's jsonb blobs parse | ✅ before pasting anywhere |
| Every generated SQL file's quotes balance | ✅ before pasting anywhere |
| No pre-existing tier-3 rows before insert | ✅ checked, then inserted |
| Row counts in Supabase after insert | ✅ 5 topics / 20 subtopics / 70 slides / 86 questions |
| Total questions across all tiers | ✅ 254 |
| `npm run check:questions` | 1 pre-existing Tier 2 error (not from today), 1 new Tier 3 false positive reviewed and allowlisted |
| Direct URL into a Tier 3 lesson (bypassing the UI lock) | ✅ renders |
| Slide rendering — heading, body, `£`, `÷`, `×`, em dashes | ✅ |
| `text` question grading | ✅ correct, confirmed twice (two separate attempts) |
| `num` question grading | ✅ correct, confirmed twice (two separate attempts) |
| `mcq` grading | ✅ correct, confirmed across both attempts |
| Reaching the last question's "Correct" screen | ✅ (attempt 1) |
| Post-completion screen (lesson-complete UI, final `progress` write) | ⚠️ not directly observed — browser tooling stopped responding at that exact step in both attempts; confirmed via Chrome directly that neither tab reached it |
| Progress row check after both attempts | ✅ none found either time — nothing to clean up |

**Not done, and deliberately:** Tier 4 (Mastery) is still empty. Same as
Tiers 2 and 3 before their sessions, its canopy branch will light up on the
dashboard the moment its topics exist — no further app code needed, only
content.
