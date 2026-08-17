# Technical log — 17 August 2026

## What this session was

Not a build session. All four tiers are seeded and the avatar / tree-label /
growth-chart / certificate-print fixes are committed, so the question was
narrower and harder: **is any of it actually broken?**

Nothing was changed. This log records how the checking was done and what it
found, because the *method* is the reusable part — the next time content lands,
this is the pass to re-run.

---

## The method, and why it wasn't "click everything"

Twenty topics, eighty subtopics, 336 questions. Clicking through every lesson is
several hours, and at the end of it you still would not know that grading is
correct — you would know that the handful of answers you happened to try were
graded correctly.

So the pass was split by *what kind of evidence each question needs*:

| Question | Best evidence |
| --- | --- |
| Does every topic load? | Query the whole curriculum once and assert its shape |
| Do all four question types grade correctly? | Run all 336 real questions through the real mapping + grading |
| Does the math render? | Run all 334 slide bodies through the real parser and the real KaTeX |
| Do the unlock/certificate rules hold? | Import the real pure functions, run them over every student |
| Does the UI actually work? | Drive it in a browser — but only for what a script can't see |

The important trick: **`journey.ts`, `certificate.ts` and `testSelection.ts`
import nothing.** No React, no Supabase. That is why they could be imported
straight into a Node script and run against real data. A file that imports
nothing is a file you can test. That property was designed in on purpose, and
this session is the first time it paid off.

`scoreAttempt` lives in `testAttempts.ts`, which *does* import the Supabase
client, so it needed a resolve hook to stub that import. Slightly more work —
worth noticing as the cost of that one import.

### The thing that could not be imported

`QuestionCard`'s grading logic lives inside `handleSubmit`, a closure inside the
component (`QuestionCard.tsx:92-120`). There is no way to call it without
rendering React. So the script had to **transcribe** those four branches.

That is a real gap, and worth naming plainly: `questions.ts` opens with a doc
comment arguing that "grading logic gets one home" — and it half-happened.
*Mapping* has one home. *Grading* does not; it is embedded in a component. The
transcription was cross-checked by answering questions of all four types by hand
in the real UI, which is why the browser pass existed at all.

If one thing gets refactored off the back of this session, it should be
extracting `gradeAnswer(question, response): AnswerResult` into `questions.ts`.
Then the grading rules get the same "importable, therefore checkable" property
the journey rules already have.

---

## What was verified, and what the evidence was

### Content, all four tiers

```
tier | topics | subtopics | slides | questions
  1  |    5   |    20     |   91   |     84
  2  |    5   |    20     |   76   |     84
  3  |    5   |    20     |   70   |     86
  4  |    5   |    20     |   97   |     82
total: 20 topics, 80 subtopics, 334 slides, 336 questions
```

Every subtopic has at least one slide and one question. `order` is contiguous
from 1 with no gaps or duplicates anywhere. No orphan slides or questions
pointing at a missing subtopic. Every `slide_type` is inside the `text | code`
CHECK constraint. No slide has an empty heading or body.

### All four question types, in all four tiers

```
tier |  mcq | multi |  num | text
  1  |   64 |     7 |    8 |    5
  2  |   55 |    11 |   10 |    8
  3  |   50 |     3 |   27 |    6
  4  |   61 |     3 |   12 |    6
```

All 336 questions were pushed through `mapQuestion()` and then graded twice —
once with a synthesised **correct** answer, once with a **wrong** one — asserting
`correct` and `incorrect` respectively. Plus per-type edge cases:

- **mcq** — `correct_answer` parses to an integer inside the options range.
- **multi** — parses as a non-empty JSON array, no duplicate indices, all in
  range; the correct set graded correct **in reverse order** too; a strict subset
  graded incorrect; selecting everything graded incorrect.
- **num** — parses finite; an answer exactly *at* the tolerance edge graded
  correct; one past it graded incorrect.
- **text** — every entry in `accepted_answers` graded correct, and graded correct
  again when upper-cased and padded with spaces; nonsense graded incorrect.

Zero failures. The `describeCorrectAnswer` output was also seen working for a
`num` question on a real results screen.

### The math in Tier 4

Tier 4 topics II and III are the first content to carry KaTeX. `parseMathSegments`
is wired into `Lesson.tsx` for **slides only** — `QuestionCard` renders
`question.prompt` as a raw string. So the first thing checked was whether any
`question_text` or `explanation` contains a `$`. **None does**, in any tier. The
gap is real but currently unreachable.

Then all 334 slide bodies went through the real `parseMathSegments`, and all 55
extracted formulas through the real bundled `katex` — but with
`throwOnError: true`, the opposite of what `Math.tsx` uses in production.

That inversion is the point. Production sets `throwOnError: false`, which means a
formula KaTeX cannot parse **silently falls back to printing raw TeX**. It looks
like a rendering bug and produces no error anywhere. Re-running with throwing
enabled is the only way to see those.

```
Slides carrying math:  19
Formulas rendered:     55
KaTeX failures:        0
Unpaired "$" in prose: 0
```

Also confirmed in the browser: `A = P(1 + r/n)^{nt}` renders as real KaTeX —
proper fraction bar, sized parentheses, superscript — not as literal LaTeX.

### The three test types

`scoreAttempt` was checked table-driven against the real function, with the
unsure rule as the case that matters:

> 10 correct, 5 unsure, 3 wrong → **55.6%**, not 76.9%

Unsures sit in the *denominator*. Scoring out of only-attempted would let a
student answer two questions, skip sixteen, and land a 100% next to a real 100%
on the growth chart. Also checked: an empty attempt scores 0 rather than
dividing by zero, and the three counts always sum to `total`.

`selectTestQuestions` had never been run at full bank size — it was written when
the bank was one tier and 84 questions, and it is now 336 across 20 topics. One
thousand runs over the real pool:

- every run returned exactly 18 questions, never a duplicate;
- all four tiers represented in **every** run;
- per-topic spread inside a single test: **0** (18 questions land in 18 distinct
  topics — the round-robin working exactly as designed);
- across runs, per-topic appearances ranged 884–915 against an expected ~900, so
  no topic is systematically favoured when 18 does not divide into 20.

That last one is the subtle bit. Within one test, fairness *cannot* be perfect —
18 questions across 20 topics means two topics always get nothing. So fairness
has to be measured across runs, which is what shuffling the deal order buys.

A real baseline was then taken through the UI as the throwaway student: one `num`
question answered correctly, the other seventeen marked "I'm not sure yet". The
results screen showed **5.6% — 1 of 18 correct**, with chips reading `1 CORRECT ·
0 NOT QUITE · 17 NOT SURE YET`. The stored row:

```
type=baseline score=5.6
questions_shown=18  answers=18   (parallel and index-aligned)
outcomes={"correct":1,"unsure":17}
unique question ids: 18   distinct topics covered: 18
```

Seventeen unsures, and not one of them shown as wrong. That is the whole design
of the three-way outcome working end to end.

### The growth chart's new colours

Verified two ways. First against `Earnest Dormouse`'s real six-attempt history,
which happens to contain a genuine dip:

```
baseline 44.4 [bark] -> Check 1 61.1 [forest] -> Check 2 55.6 [terracotta] -> Check 3 83.3 [forest]
```

Progress Checks are correctly excluded from the chart — Dormouse has two of them
and neither appears. Mixing a topic-scoped Progress Check into a
whole-curriculum trend line would make an easy test look like growth.

Then on screen, with a seeded rise/dip/rise: the baseline dot is **filled solid**
in bark while every later point is hollow, rise legs are forest, the dip leg is
terracotta, and the legend lists exactly the three colours actually present.
Shape as well as colour for the baseline, so it survives colour-blindness.

### Certificate gating

`deriveCertificate` takes only `journey` + `completions`. It never reads
`test_attempts` — so **no test result can move the gate**, structurally. That is
the cleanest possible answer to "did the test changes affect certificate
gating?": they cannot.

The rule was then re-derived independently and compared against the
implementation for all 14 students. Every one agreed. The four shapes that
matter:

| Student | State | Earned |
| --- | --- | --- |
| Test Student D | all four tiers | yes |
| Sunny Squirrel | trunk + Tier 2, Tier 3 partial | yes |
| **Frosty Shrew** | **trunk complete, Tier 2 at 12/20** | **no** |
| Earnest Dormouse | trunk only | no |
| Careful Pipit | trunk at 8/20 | no |

Frosty Shrew is the case the rule exists for: finishing the trunk is not enough.

In the browser, unearned shows a watermarked preview and both **Save as PDF** and
**Print blank version** carry real `disabled` + `aria-disabled="true"` — not just
a "locked" label over a working button. Earned drops the watermark, lists only
the completed tiers, and dates itself **9 August 2026**, the last completion
among the tiers it names — not today's date, which would re-date the certificate
every time the page opened.

### The print fix

The print layout was checked by flipping the `@media print` block to `@media all`
and re-measuring — never by calling `window.print()`, which opens a modal dialog
that freezes browser automation.

`prepareForPrint()` measures the card's height at its *current on-screen* width
and assumes height is width-independent. That assumption was tested rather than
taken on trust: at 1040px the card is 852.42px tall, at the print width of 1336px
it is 852px. Width-independent, confirmed.

```
card rendered   1028.031 x 655.926
page box        1028.031 x 699.213   (272mm x 185mm)
sheet box       1028.031 x 699.203
```

Scale lands at 0.7695, horizontal offset at 0, and `body.scrollHeight` collapses
to exactly 699px — one page, with ~43px of vertical slack. Note this was
*emulated* print media, which is close to but not identical to real pagination.

---

## Findings

Four things. Only the first is likely to bite a real student in the pilot.

### 1. A Progress Check is offered after one lesson, then refused — 16 of 20 topics

`startedTopics` offers a topic in the picker as soon as **one** subtopic is done
(`Progress.tsx:197`, `completedCount > 0`). But the Progress Check pool is
filtered to *completed subtopics within the picked topics*, and
`MIN_TEST_QUESTIONS` is 5, while subtopics carry 3–5 questions:

```
3 questions: 10 subtopics
4 questions: 44 subtopics
5 questions: 26 subtopics
```

So in **16 of the 20 topics**, a student who has finished exactly subtopic 1 gets
a pool of 3–4 and is refused. Confirmed live:

> **COULDN'T START THIS TEST** — There aren't enough questions yet in the topics
> you picked. Try selecting one or two more topics you've finished, or finish more
> of the ones you chose.

The advice is impossible. The unlock chain is strictly sequential, so a student
at their first lesson has exactly **one** topic started — there are no "one or two
more topics you've finished" to select. Only the second half of the sentence is
actionable.

This is day one of the pilot: finish your first lesson, be offered a check on it,
be told no.

Three ways out, in increasing effort: disable the chip (with a reason) until its
completed subtopics clear the minimum; lower `MIN_TEST_QUESTIONS` to 3; or let a
Progress Check top up from unfinished subtopics in the chosen topic. The first
keeps the diagnostic honest and is the smallest change.

### 2. A Progress Check taken first permanently removes the baseline

`isFirstTest` is `attempts.length === 0` over **all** attempts, including
`progress_check` (`Progress.tsx:134`), and it decides the button:

```ts
to={`/test?type=${isFirstTest ? "baseline" : "growth_check"}`}
```

So a student whose first-ever test is a Progress Check can never record a
baseline — the offer is gone for good, and the growth chart loses the reference
point everything else is measured against.

Reachable: finish two subtopics of topic 1 (pool of 7, clears the minimum), take
a Progress Check, and the baseline is gone. Doing lessons before tests is the
*natural* order, so this is not an exotic path.

Fix is one predicate: count only `baseline` and `growth_check` attempts when
deciding, which is the same filter `toGrowthPoints` already applies.

### 3. The first charted point can be labelled "Check 0"

Same root cause. `toGrowthPoints` labels by index:

```ts
week: i === 0 && attempt.test_type === "baseline" ? "Baseline" : `Check ${i}`
```

If the first *charted* attempt is a `growth_check` — because the baseline was
never taken (finding 2) or failed to save — then `i === 0` and the label is
**"Check 0"**. Verified:

```
charted: "Check 0" 70% [bark]  "Check 1" 65% [terracotta]
```

Cosmetic, but it is the first thing on the axis. Fixing finding 2 makes it much
rarer; a one-line label guard removes it.

### 4. `check:questions` now errors on Tier 2 content

The wording checker had not been re-run since Tier 4 landed. It exits 1:

```
1 error, 2 warnings, 3 suppressed by review.
```

All three look like false positives to me, of exactly the class the `REVIEWED`
allowlist exists for:

- **`466f91ed` (error, `num-without-digits`)** — *"What number connects you
  directly to your bank's fraud team in the UK?"*, answer `159`. Genuinely
  digit-free, and genuinely self-contained — the same class as the already-reviewed
  inflation-target question, and as the "How many days are in a week?" example in
  the rule's own doc comment.
- **`23481fbd` (warning, "above")** — *"BNPL is pre-selected above 'pay in
  full'"*. "Above" is spatial position on a checkout page, described inside the
  question. Not a back-reference.
- **`dc629321` (warning, "below")** — *"listed well below what it normally sells
  for"*. A price comparison, not a back-reference.

I have **not** added the `REVIEWED` entries. The script's own comment says an
entry there "is a decision, not a mute button", and permanently suppressing a
content check is the author's call, not mine. The reasons above are ready to
paste if you agree.

### Not a finding, but worth re-confirming

A `num` answer is still stored as the **string** `"25"`, not the number `25` —
visible in the baseline row written this session. This is the documented quirk in
`testAttempts.ts` (the long note on `QuestionResponse`), still harmless because
nothing reads a stored `num` response back. Unchanged, not new.

---

## Test-fixture state after this session

One throwaway student was created for everything that writes rows, so the
existing fixtures stayed clean:

- **`Test Student A`** (PIN `REDACTED-PIN`, teacher `teacher@example.invalid`) — all 80
  subtopics complete, one real baseline at 5.6%, three seeded growth checks
  (61.1 / 44.4 / 77.8) shaped as rise-dip-rise for the chart colours.
- **Test Student D** — untouched. Still 100%, certificate earned, dated 13 August
  2026. Verified by re-running the gating check after all browser work.
- Every other seeded account — untouched.

`Test Student A` is worth keeping: it is now the only account that exercises an
earned certificate *and* a three-colour growth chart *and* a real stored attempt.

## Housekeeping

`tsc -b && vite build` passes clean. `oxlint` reports one pre-existing warning
(`TestFlow.tsx:174`, exhaustive-deps). The migration
`20260818000000_split_avatar_shape_and_colour.sql` **is** applied to the live
project — checked first, because `AuthProvider` selects `avatar_shape` and
`avatar_colour` and every student page would break if it were not. The legacy
`avatar_leaf` column is gone and the `set_avatar_leaf` RPC exists with
`(p_shape, p_colour)`. A student with a null avatar falls back to initials rather
than crashing.

---

# Porting the Lovable tree design into `JourneyTree`

A new tree design was built in Lovable (`artenzie/design-dashboard-delight`) and
this session ported its *visual language* into our real component. The scope was
deliberately narrow: `src/components/sprig/JourneyTree.tsx` and nothing else.
`git status` at the end shows exactly one modified file, which is the whole
proof that the nav, the left rail and the stats are untouched — they were never
opened.

The Lovable project is one file, `src/routes/index.tsx`, and it is entirely
mock: 20 nodes, all hardcoded as complete, no data layer at all. So the port is
not a copy. It is "take the drawing technique, throw away the fake data, and
re-attach it to `useJourney`".

## The three techniques worth understanding

### 1. Limbs are generated from a centreline

The old trunk was a hand-written SVG path that described *both* edges of the
shape — you edited the left edge, then edited the right edge to match, and hoped
they stayed parallel. The new `Limb` component takes a **centreline** (a chain
of cubic Beziers, one line of coordinates) and builds the filled shape itself:

- walk the curve in 26 steps per segment;
- at each step, find the tangent by sampling a hair either side of the point;
- rotate that tangent 90 degrees to get the **normal** (the sideways direction);
- step out along the normal by half the current width, in both directions;
- collect the left offsets forwards and the right offsets backwards, and close.

Changing a branch is now moving four control points instead of rewriting two
edges.

One detail carried over deliberately: the width interpolates with
`Math.pow(t, 0.75)`, not linearly. A linear taper thins too evenly and reads as
a traffic cone. The exponent keeps the limb thick for longer near the base and
then narrows quickly, which is how a real branch carries its load.

### 2. The canopy is grown around the labels, not behind them

This is the clever bit of the Lovable design and the reason the whole port
hangs together. Each tier's foliage is one organic blob, and it is computed to
**contain that tier's node discs and label text boxes**.

`tierPoints()` produces those points. `organicBlob()` turns them into a closed
contour using the **support function**: for each of 42 directions around a
circle, project every point onto that direction and keep the furthest. That is a
convex hull in polar form, so it is guaranteed to enclose everything. Straight
off it looks like a cut gem, so the radii are then smoothed with a small
circular kernel and multiplied by a few low-frequency sine waves to get a
hand-drawn irregularity.

The consequence: rename a topic to something longer and the canopy swells to
hold it. The labels never fall off the foliage.

Except they did — see the bugs below.

### 3. `pathLength={1}` makes a progress line trivial

Each canopy has a lesson path threading through its five nodes, drawn twice: a
dim full-length line, and a bright overlay covering the completed portion. The
overlay sets `pathLength={1}`, which tells SVG to *renormalise* the path so its
total length is exactly 1 whatever its real geometry. `strokeDasharray` can then
be written as a plain fraction (`${completed / 5} 1`). Without it, we would have
to measure the path in the DOM with `getTotalLength()` and re-measure on resize.

## The design decision the port forced

In the Lovable mock, labels sit *inside* the dark canopy in cream text. That is
only safe if **every** canopy stays dark enough to carry cream text. So "pale
green = not started yet", which is what the old tree did with its mint branches,
was not available: a pale canopy would leave its own labels illegible.

The measured overlap between neighbouring canopies is 209 units (Application /
Mathematics) and 170 (Mathematics / Mastery). At that overlap a tier's labels
routinely sit on a *neighbouring* tier's foliage, so a mixed light/dark scheme
would put dark text on dark foliage in exactly the state that happens most —
one tier reached, the next not.

So the state lives elsewhere:

- **Dormant tier** — muted bark grey-green canopy, no fruit, no highlight lobe.
- **Reached tier** — full forest green, highlight lobe, fruit.
- **Fruit** — one berry per completed topic. Fruit is the only thing on the tree
  that is purely earned; an untouched canopy carries none.
- **Trunk leaves** — one per completed Tier I topic.
- **Nodes** — filled disc plus tick (complete), terracotta ring plus "NOW"
  (current), lock glyph and 68% opacity (locked).

A tier counts as "reached" when any of its topics is complete **or current** —
reached, not finished, because the branch you are working on should look alive.

## Two bugs the verification caught

Neither would have been obvious from reading the code.

**The canopy did not actually contain its labels.** The wobble that makes the
contour organic is `1 + 0.055·sin(2a) + 0.04·sin(3a) + 0.025·sin(5a)`, which
swings about ±12%. On a *downswing* it multiplies the radius by 0.88 and pulls
the contour **inside** the padded hull — and a label near the edge ends up half
off the foliage, cream text on cream paper, invisible. On the "Tier I done" state
that was the label of the topic the student is currently on. Fixed by clamping
the wobble to `Math.max(1, wobble)` for the main contour: it bulges outward only,
still irregular, never inward.

The second half of the same bug was the `yMax` clip that stops a canopy drooping
over the trunk. It was a flat `Math.min`, so for downward directions it happily
cut inside the content. It is now floored at the unpadded support distance: the
clip may eat the *padding*, never the content.

Both were found by a throwaway script that mirrors `organicBlob` and runs a
point-in-polygon test over every label corner and a ring of points around every
disc. Under the old geometry it reported exactly three escaping points, one per
tier; under the fix, 180/180 contained. Worth remembering as a technique — the
property "this text is on top of that shape" is checkable arithmetic, not
something you should be squinting at screenshots to confirm.

**SVG `role="button"` is not a button.** The first version made each node an
`<g role="button" tabIndex={0}>` with an `onKeyDown` handler, because the label
has to be SVG for the canopy trick above. It focused and clicked correctly. But
reading the page's accessibility tree returned **zero** controls where there
should have been twenty — assistive-technology support for roles on SVG
containers is patchy.

It is now back to what the old tree did: the SVG is `aria-hidden` artwork, and a
transparent HTML `<button>` sits over each disc, positioned as a percentage of
the wrapper. That works because the wrapper is given the viewBox's own aspect
ratio and the SVG is stretched to fill it, so viewBox units and wrapper
percentages describe the same grid at every screen size. Locked nodes render a
**disabled** button rather than no button — dropping them would hide the locked
half of the curriculum from a screen reader, when the entire reason locked
topics are drawn rather than hidden is that the student can see what is coming.

## Verification

The live accounts are all at 100%, so they only exercise the `complete` state. A
temporary harness (`preview.html` + `src/preview-main.tsx`, both deleted
afterwards) rendered the component against five synthetic completion sets fed
through the **real** `deriveJourney()` — so the unlock rules under test were the
production ones, not a mock.

| Scenario | Buttons | Enabled | Canopy fruit |
| --- | --- | --- | --- |
| Brand new student | 20 | 1 (I.I) | 0 |
| Tier I done, into Application | 20 | 6 | Application only |
| Everything complete | 20 | 20 | 15 |

Click-through was checked on the live dashboard: II.I navigates to
`/topic/ce63ffcf-…`, unchanged. `tsc -b && vite build` passes clean.

Not verified against a genuinely partial *live* account, because none exists —
`Test Student D` and `Test Student A` are both at 80/80.
