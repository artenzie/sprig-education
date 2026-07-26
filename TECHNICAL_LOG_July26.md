# Technical log — 26 July 2026

## Verifying the baseline flow against a real database

The 25 July log ended with a short list of things that had been built but not
demonstrated: a real run through the browser, and a written row inspected in
`test_attempts`. This session did exactly that, found one genuine content bug and
one quiet type inconsistency, fixed the first and documented the second.

Nothing in the test flow's logic changed. That is the point — the code was
already right, and the value of this session is that it is now *known* to be
right rather than believed to be.

---

## 1. Why a browser run proves something unit tests cannot

The selection logic was already exercised 500 times over synthetic banks last
session. That testing was real and it caught real bugs. But it could not catch
what this session caught, and the reason is worth understanding.

A unit test runs the code with inputs *you* chose. It confirms the function does
what you think it does. What it cannot confirm is whether the assumptions
surrounding the function still hold once it is wired to everything else — the
database, the auth session, the rendered page, the actual seeded content.

Every bug found today lived in exactly that gap:

- A question whose text was correct in the Lesson flow and broken in the test
  flow. Both flows worked. The *content* was wrong for one consumer.
- A stored value whose type was legal, whose code compiled, and whose shape was
  still not what the documentation claimed.

Neither is reachable by testing `selectTestQuestions()` in isolation, however
many times you run it, because neither is a defect *in* that function.

**The general lesson:** unit tests verify logic; end-to-end runs verify
assumptions. You need both, and they fail in different places.

---

## 2. Predicting the result before submitting

The test was taken as a real student, answering 18 questions with a deliberate
mix: some genuine answers, two knowingly wrong, three marked "I'm not sure yet".

The important discipline was **writing down the expected result first**: 13
correct, 2 incorrect, 3 unsure, score 72.2. The screen then showed exactly that.

This matters more than it looks. Had the score simply been "some number that
seemed plausible", nearly any scoring bug would have passed. 72.2% looks
reasonable. So does 86.7%. The difference between them is the entire design
decision from last session:

```
13 / 18 = 72.2   <- unsures counted in the denominator
13 / 15 = 86.7   <- unsures excluded
```

Seeing 72.2 is what confirms the rule. Seeing "a plausible percentage" confirms
nothing at all.

**The general lesson:** a verification that cannot fail is not a verification.
Predict the specific number, then look — otherwise you are just admiring output.

---

## 3. Checking the row, not just the screen

The screen and the database can disagree. The check that matters is not "does
the row exist" but **"does the row still say the same thing the screen said"**.

So the stored `answers` array was re-scored independently:

```js
const tally = { correct: 0, incorrect: 0, unsure: 0 };
for (const a of answers) tally[a.outcome]++;
const recomputed = Math.round((tally.correct / answers.length) * 1000) / 10;
// 72.2 === row.score
```

This is only possible because of a decision made last session: the counts are
*not* stored, only the per-question outcomes are. `score` is therefore derivable
from `answers`, and the two can be checked against each other.

Had the counts been stored as their own columns, this check would have been
impossible — there would be nothing independent to compare against. The stored
count would simply have been trusted.

**The general lesson:** storing facts rather than summaries does not only prevent
disagreement, it makes disagreement *detectable*. A derived value can be
recomputed and checked; a stored summary can only be believed.

Everything else in the row held up: 18/18 in both arrays, aligned index-by-index
on `question_id`, no missing ids, and the questions spread **4, 4, 4, 3, 3 across
five topics** — a maximum difference of 1, which is the round-robin dealing in
`selectTestQuestions()` behaving exactly as documented.

---

## 4. RLS: proving a negative properly

`fetchTestAttempts()` deliberately carries no `student_id` filter. Its safety
comes entirely from the RLS policy. Last session flagged that this reliance
should be *demonstrated*, not asserted.

Signing in as a second student and seeing an empty growth chart is a start, but
it is weak evidence on its own — the page could be empty for a dozen reasons that
have nothing to do with security. So the check was pushed below the UI, calling
the REST API directly with the second student's own token:

| Probe | Expected | Got |
|---|---|---|
| `SELECT` all attempts | 0 rows | `200 []` |
| `INSERT` with another student's `student_id` | rejected | **403, `42501`** |
| `INSERT` as self (control) | succeeds | `201` |
| `UPDATE` the other student's row by id | 0 rows | `200 []` |

Two of these are subtler than they look.

**Probe 1 returned `200 []`, not an error.** That distinction is the whole
lesson of the earlier grant bug. A missing `GRANT` produces `42501 permission
denied` — a loud failure. RLS filtering produces an empty, successful response.
Getting `200` with zero rows proves the grant is present *and* the policy is
doing the filtering. An error would have meant the data was protected by
accident.

**Probe 3 is why probe 2 can be trusted.** A 403 on its own is ambiguous — the
endpoint might simply be broken, the token expired, the table misnamed. Any of
those produce a failure that looks like security working. Inserting a legitimate
row immediately afterwards and getting `201` removes every one of those
explanations, leaving only the intended one: the `with check` clause rejected the
forged `student_id` specifically.

**The general lesson:** to prove a thing is blocked, you must also prove the same
path is open when it should be. A test that only ever sees failure cannot tell
"blocked" from "broken".

Probe 4 confirms the `using` clause: the row is invisible to `UPDATE`, so the
attempt matched zero rows rather than being rejected. The other student's score
was untouched afterwards. The control row created by probe 3 was deleted.

---

## 5. The content bug: a question that was correct until it moved

Question `61e19c00` read:

> Using the example above, at what amount would the halfway checkpoint sit?

It arrived in the baseline as a numeric input with no numbers anywhere on screen.

The instinct is to call this a badly written question. It was not. "The example
above" is the question immediately before it in the same subtopic — £80
headphones at £5 a week — reinforced by a slide carrying the same figures. In the
Lesson flow, where order is fixed and slides sit above, **the referent is
genuinely there**. The wording was correct when it was written.

What changed is that a second consumer appeared. `selectTestQuestions()` shuffles
within a topic and deals round-robin across topics, so a question now arrives
with no guarantee that anything preceding it is on screen, or in the paper at
all.

This is a **contract mismatch**, not a typo. The same row is read under two
different sets of guarantees, and nothing in the schema records which one it was
authored against.

That is why it fails in the worst available way: the question renders perfectly.
There is no error, no crash, no empty state. A student simply sits in front of an
unanswerable question and concludes they are the problem.

The fix restates the numbers in the question itself:

> Target: £80 headphones, saving £5 a week. At what amount would the halfway
> checkpoint sit?

Two details in the migration are worth understanding:

- **`update`, not delete-and-reinsert.** `questions_shown` and `answers` in
  `test_attempts` store question *ids*. Replacing the row would orphan every
  attempt that already referenced it. Editing in place keeps history intact.
- **`correct_answer` is unchanged (`40`)**, so no already-stored attempt becomes
  wrong retrospectively. An edit that changed the answer would silently rewrite
  history for anyone who had already sat the test.

The new wording repeats numbers that also appear in the previous question. That
redundancy reads slightly oddly in the lesson and is the correct trade: a
question that stands alone everywhere beats one that reads elegantly in exactly
one context.

---

## 6. Turning one fix into a guard

One broken question out of 84 is not, by itself, a crisis. The reason it was
worth building a check is that **the conditions that produced it are structural
and get worse**:

- All 84 questions were authored for the Lesson flow. The test flow is a newer
  consumer with weaker guarantees, and nothing records the difference.
- 20 of 84 questions (24%) already sit in sequence-flavoured subtopics — "Worked
  Examples", "Practice: ...", "Applied" — where chaining is the *natural* way to
  write.
- Tiers 3–4 are Mathematics and Mastery, the tiers most likely to carry
  multi-step worked examples, on a bank heading for roughly four times its
  current size.

So: `scripts/check-questions.ts`, run via `npm run check:questions`.

### The rule that matters

```
a `num` question whose text contains no digits
```

A question demanding a numeric answer while supplying no numbers is almost
certainly broken. It is a **heuristic, not an invariant** — "How many days are in
a week?" is a legitimate digit-free numeric question — but it has zero false
positives on the current bank and it is precisely the rule that would have caught
this one before a student saw it.

### Warnings, and why they are not errors

Back-references ("above", "same scenario", "earlier") are warnings, because only
a human can distinguish:

- *"Same scenario (£25 for the month; A transport £12, D shoes £18)..."* — fine,
  it restates everything it needs
- *"Same scenario. What is the total?"* — broken

A regex cannot tell those apart. A person reading the flagged line can, in
seconds. **Severity should reflect how confident the rule is, not how much you
want it obeyed** — a check that cries wolf gets muted wholesale, taking its
genuine findings with it.

### The allowlist stores reasons, not just ids

```ts
const REVIEWED: Record<string, string> = {
  "676f3abf-...": 'Says "Same scenario" but restates every figure it needs.',
  "e7ce01d5-...": 'Matches on "below" only via "go below zero" — not a back-reference.',
};
```

An id alone is a mute button; an id with a reason is a recorded decision. The
documented hazard: **ids survive text edits**, so a stale entry could later
suppress a genuine new problem in a rewritten question.

Bare "above" and "below" were kept in the regex despite causing one false
positive ("can't go below zero"). Those bare words are what caught the real bug;
the narrower pattern would have missed it. One reviewed suppression is a better
trade than a miss.

### Verifying the checker itself

**A checker that passes on clean data has demonstrated nothing.** So the question
was temporarily reverted to its original broken wording:

```
ERROR (1):   [num-without-digits]   exit 1
WARNING (1): [back-reference]
```

Both rules fired independently, then the fix was restored and the run went clean
at exit 0. This is the same principle as probe 3 in the RLS section: to trust a
detector, watch it detect.

---

## 7. The type inconsistency, documented rather than fixed

Inspecting the stored row showed `num` answers coming back as `"80"` and `"30"` —
**strings**, though `QuestionResponse` documented "a number for num".

The cause is ordinary: a DOM input reports `value` as a string even when it is
`type="number"`, and nothing coerces it on the way through.

The interesting part is why nobody noticed. `QuestionResponse` is:

```ts
number | number[] | string | null
```

`string` is in the union already, for the `text` question type. So the wrong
branch is still a *legal* value, and TypeScript has nothing to complain about.
**A union type only catches values from outside the union — it cannot catch the
right value in the wrong slot.**

It was documented rather than changed, deliberately. It is harmless today because
nothing reads a stored `num` response back; the outcome is decided at answer time
and only `outcome` is used afterwards. It would bite the first time something
compares numerically — `response === 80` is `false` for `"80"` — and the
missed-question cards are the likely candidate. Changing it now would also mean
migrating rows already written, for no present benefit. The comment records the
finding, the cause, and the intended fix (coerce at capture, not by widening the
type) for whoever meets it next.

---

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20260726000000_...sql` | Rewrites question `61e19c00` to carry its own numbers |
| `scripts/check-questions.ts` | New — self-containment checker |
| `package.json` | Adds `npm run check:questions` |
| `src/lib/testAttempts.ts` | Comment documenting the `num`-as-string inconsistency |

## Verified

- A real baseline taken through the browser end to end: login on the starter PIN,
  the forced PIN change, 18 questions, score, and the saved row.
- The predicted score (72.2) matched the screen, and matched the row when
  independently recomputed from the stored answers.
- Stratification confirmed on real content: 4, 4, 4, 3, 3 across five topics.
- RLS isolation confirmed at the API level, including a successful control write
  proving the rejection was the policy and not a broken endpoint.
- The checker verified against the real bug, not just against clean data.
- `oxlint` clean; `tsc -b` and `vite build` clean.

## Not verified

- **The `progress_check` test type.** Only `baseline` has been through a real
  run; the topic-selection path into a Progress Check is still unexercised.
- **The growth chart with more than one point.** It renders correctly at exactly
  one attempt (the divide-by-zero guard holds), but a real second attempt has
  never been plotted against a first.
- **The missed-question cards**, which remain an honest empty state — they need a
  query that does not exist yet.

The natural next piece of work is the second attempt: take a Growth Check as the
same student and watch the chart draw a line between two real points. That also
exercises the `isFirstTest` branch in the other direction, which today was only
ever observed flipping from true to false once.
