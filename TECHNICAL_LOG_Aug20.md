# Technical log — 20 August 2026

## A batch of small fixes

No new tables, no migrations, no new routes. Seven unrelated tweaks across copy,
two logos, a footer, an SVG drawing and the avatar picker — committed together as
`8b84420`, 11 files, +187/−51.

Small changes are worth a log precisely *because* they look trivial. Four of the
seven turned out to rest on something non-obvious: the sign convention of SVG's
coordinate system, a parsing rule in XML that fails silently, a design token
doing two jobs that pull in opposite directions, and the difference between a
value you may change freely and an id the database is holding you to.

Files touched:

- `index.html` — title, meta description
- `public/favicon.svg` — redrawn
- `src/index.css` — six new `--leaf-*` tokens
- `src/lib/leafAvatars.ts` — colour list repointed
- `src/components/sprig/TopNav.tsx` — nav label, picker layout
- `src/pages/Lesson.tsx` — leaf rotations
- `src/pages/{Landing,Help,Login,Dashboard,Topic}.tsx` — copy and footers

---

## 1. The wilting sprig: SVG's y axis runs *downward*

The growing plant beside the lesson progress counter had its leaves pointing
down. On a component whose entire job is to say "you are growing", that is worse
than a cosmetic bug — it communicated the opposite of the thing it was there to
communicate.

The leaves are defined in `SprigPlant` as a list of positions and rotations:

```tsx
const leaves = [
  { cx: 43, cy: 74, rot: -55 },  // leaf 1 (appears at stage 2)
  { cx: 57, cy: 66, rot: 55 },   // leaf 2 (appears at stage 3)
  ...
];
```

and drawn as a horizontal ellipse inside a rotation:

```tsx
<g transform={`rotate(${l.rot} ${l.cx} ${l.cy})`}>
  <ellipse cx={l.cx} cy={l.cy} rx={leafRx} ry={leafRy} ... />
</g>
```

`rx` is 6.5 and `ry` is 2.6, so the blade is a flattened ellipse lying flat
along the x axis before any rotation. The stem runs up the middle of the canvas
at x = 50, and leaf 1 is centred at x = 43 — to the *left* of the stem. Its
inner end nearly touches the stem at 43 + 6.5 = 49.5, and its outer tip sits at
43 − 6.5 = 36.5.

So the question "which way does the leaf point?" is really "where does the
local offset `(-6.5, 0)` land after the rotation?"

**The concept.** In maths class, a positive angle turns counter-clockwise. In
SVG it turns *clockwise*, and the reason is that SVG's y axis grows **downward**
— y = 0 is the top edge of the canvas, y = 120 is the bottom. Flipping one axis
flips the direction of rotation with it. The rotation matrix is unchanged:

```
x' = x·cos(θ) − y·sin(θ)
y' = x·sin(θ) + y·cos(θ)
```

but a larger `y'` now means *further down the screen*, not further up.

Work leaf 1 through with the old `rot: -55`, where `cos(-55°) = 0.574` and
`sin(-55°) = -0.819`:

```
x' = (-6.5)(0.574) − (0)(-0.819) = -3.73
y' = (-6.5)(-0.819) + (0)(0.574) = +5.32
```

The tip lands 3.73 to the left and **5.32 down**. Drooping. Every one of the
four leaves had the same problem, because they all followed the same convention
of "negative on the left, positive on the right" — which is the correct
convention in a y-up coordinate system and exactly backwards in a y-down one.

The fix is one character per leaf. With `rot: 55`:

```
y' = (-6.5)(+0.819) = -5.32
```

Same distance, opposite direction: up and out, the way a leaf reaching for light
sits. The magnitudes were left alone, so the silhouette and spacing that had
already been tuned are the ones still on screen — only the direction changed.

The stage-0 cotyledons (the two seed-leaves on the sprout) had the same bug from
the same cause, at `-30` and `+30`, and were flipped with them.

**The lesson worth keeping:** when you find one sign error in a y-down
coordinate system, check every sibling. A single wrong leaf is a typo; four
wrong leaves and two wrong cotyledons is a *convention* applied in the wrong
space, and the convention is what you have to fix.

---

## 2. A bug I wrote and caught: XML comments cannot contain `--`

The favicon and the header logo were unrelated drawings — the tab showed a
stroked upright trunk with three outlined leaves, the page header showed a
curved stem with two leaves in forest and terracotta. Two logos for one product.

The fix was to redraw `favicon.svg` as a copy of the `SprigMark` component, with
the CSS custom properties resolved to literal hex (a favicon has no page to
inherit custom properties from, so `var(--forest)` there resolves to nothing and
the mark renders invisible).

I wrote a header comment explaining that, and the comment contained the text
`var(--forest)`.

**That broke the file.** XML forbids a double hyphen inside a comment — the
`--` sequence is reserved as part of the `-->` terminator, and a conforming
parser must reject the document rather than guess. Chrome serves and parses
`image/svg+xml` strictly as XML. The result would have been no favicon at all:

```
xml.parsers.expat.ExpatError: not well-formed (invalid token): line 12, column 40
```

The dangerous part is the *failure mode*. There is no console error, no red
text, no 404 — the file is served with `HTTP 200` and `Content-Type:
image/svg+xml`, and the browser simply shows a blank or default tab icon. If you
verify a favicon by glancing at the tab, you will read "blank" as "cache" and
move on.

I caught it by parsing the file instead of looking at it:

```bash
python -c "import xml.dom.minidom; xml.dom.minidom.parse('public/favicon.svg')"
```

**The concept.** A rendered check answers "does this look right?" A parse check
answers "is this well-formed?" They are different questions, and for a format
with a silent failure mode the second is the one that catches you. The rewritten
file now talks *around* the CSS variable syntax rather than quoting it, and says
in the comment why.

There is a related trap in JSX, which cost a `tsc` error in the same session:

```tsx
) : (
  {/* a comment */}     // ← parsed as an object literal, not a comment
  <Link ... />
)
```

Inside a ternary branch the parser is expecting an *expression*, and `{...}`
there is an object literal. A bare `/* ... */` block comment is what belongs in
that position. Both traps are the same shape — comment syntax that is fine
almost everywhere and illegal in one specific context.

---

## 3. One token, two jobs: why the leaf colours were split out

The avatar picker's six colours pointed straight at the palette:

```ts
{ id: "mint", label: "Mint", token: "var(--mint)" },
```

which reads like good practice — reuse the design system, do not invent
colours. It was the root of the problem.

Look at the values (oklch: lightness, chroma, hue) against the cream page
background at lightness `0.975`:

| id | before | lightness gap vs. cream |
|---|---|---|
| `forest` | `0.56 0.075 168` | 0.415 |
| `sage` | `0.82 0.040 155` | 0.155 |
| `mint` | `0.90 0.045 165` | **0.075** |
| `terracotta` | `0.70 0.130 45` | 0.275 |
| `gold` | `0.78 0.110 88` | 0.195 |
| `bark` | `0.44 0.020 130` | 0.535 |

`--mint` and `--sage` are **tinted panel backgrounds**. Sitting a whisker away
from the paper is exactly what you want from a background — that is the whole
point of a tint. It is exactly what you do *not* want from a small leaf drawn on
that same paper, where it disappears.

You can see the workaround this forced in `LeafAvatar`: every blade is drawn
twice, once in `--ink` at `strokeWidth 2.6` and again in its own colour at
`1.4`, so the dark contour underneath drags the pale ones back into view. That
contour is a fine design decision on its own, but it had become load-bearing —
it was propping up colours that could not carry themselves.

**The concept: a token's value encodes its job.** `--mint` was being asked to be
both a background tint and a foreground fill, and those two jobs want opposite
lightness. When one token has two jobs with conflicting requirements, the answer
is not to compromise the value — it is to split the token.

So the picker got its own set:

```css
--leaf-forest:     oklch(0.55 0.095 168);
--leaf-sage:       oklch(0.67 0.055 150);
--leaf-mint:       oklch(0.75 0.075 190);
--leaf-terracotta: oklch(0.66 0.125 42);
--leaf-gold:       oklch(0.75 0.115 85);
--leaf-bark:       oklch(0.50 0.055 55);
```

Tuned as a *set* rather than one at a time: lightness now spans 0.50–0.75
instead of 0.44–0.90, and chroma 0.055–0.125 instead of 0.02–0.13. No option is
dramatically louder or fainter than its neighbours.

Two specific moves are worth naming:

- **`mint` moved from hue 165 to 190.** Three of the six sat within 13 degrees
  of each other (168, 165, 155) and separated only by lightness — so half the
  picker read as one green at three exposures rather than three choices. Hue
  distance, not lightness distance, is what makes colours read as *different
  colours*.
- **`bark` moved from chroma 0.02 to 0.055, hue 130 to 55.** At two hundredths
  of chroma it was effectively grey with an olive cast, which next to terracotta
  and gold read as dirty rather than as wood.

The site-wide palette was not touched, so nothing outside the picker moved.

---

## 4. Values are free; ids are a contract

The obvious way to fix a colour set is to rename the bad entries — drop `bark`,
add `plum`. That was not available here, and the reason is worth internalising.

The colour id is written into `students.avatar_colour`, and it is pinned in
**two** places in the database:

```sql
alter table students add constraint students_avatar_colour_check
  check (avatar_colour is null or avatar_colour in (
    'forest', 'sage', 'mint', 'terracotta', 'gold', 'bark'
  ));
```

and again inside the `set_avatar_leaf()` function, which re-validates its
argument so a bad value surfaces as a clear error rather than a raw
check-violation.

So the file has two kinds of data in it that look identical and behave nothing
alike:

```ts
{ id: "bark",        // ← a contract with the database. Changing this is a migration.
  label: "Bark",     // ← client-side only. Free.
  token: "var(--leaf-bark)" }  // ← client-side only. Free.
```

**The concept.** An identifier that has been persisted stops being a name and
becomes a key. Every row already storing `'bark'` is a claim that the string
`'bark'` will keep meaning something. You can change what `bark` *looks like*
for free, and every existing avatar silently improves. You cannot change what it
is *called* without a migration to carry the old rows forward.

This is why the whole recolour was possible as a CSS edit: **not one id moved.**
Every student who had already picked a colour kept it, and simply got a better
version of it.

---

## 5. A label that advertises something that does not exist

The nav button now reads **Login / Sign Up**, and there is no sign-up form
behind it — for students there never can be, because an account is a nickname
and PIN handed out by a teacher, which is the mechanism that keeps students
anonymous in the first place.

Two ways to handle that mismatch:

1. Keep the label honest and narrow: `Log in`. Someone with no account has
   nothing to click and no explanation.
2. Widen the label and make the destination carry the answer.

The second is the better trade, but only if the destination actually answers.
So the `/login` student box was extended from a bare pointer into a real
explanation:

> Don't have an account? **Ask your teacher or parent.** There's no sign-up
> form — accounts are handed out in class, so nobody has to give us a name or an
> email.

That sentence does three jobs: tells them what to do, tells them no form is
missing (so they stop hunting for it), and gives the *reason*, which is a
feature of Sprig rather than a limitation.

**The concept:** a navigation label is a promise about what is on the other
side. You may widen the promise, as long as you widen what is there to meet it.

---

## 6. Copy consistency is a search problem

The audience description changed from "UK students aged 13–14 (Year 8–9)" to
"younger teenagers who are curious about money". It lived in **five** places:
the Landing page, a Help FAQ answer, two footer strips, and the `index.html`
meta description.

Dropping "UK students" risked losing something true and load-bearing: the
*content* is UK-specific — pounds, VAT, FSCS protection, the Bank of England. So
each rewrite states that separately, and now says it more explicitly than the
old phrasing ever did.

The method matters more than the wording. Before editing:

```bash
grep -rn "13\|Year 8\|aged\|UK\b" src/ index.html
```

and after, a sweep for anything left behind:

```bash
grep -rn "Ed\. 03\|Ages 13\|Year 8\|aged 13\|13–14" src/ index.html public/
```

**The concept:** any string a user reads is probably not in one file. Finding
every instance is a search problem, and the closing search — proving the old
string is *gone* — is the half people skip. That second sweep is what caught the
footers, which were not on the original list.

Reading the result back also caught a copy bug the diff could not: the rewritten
FAQ answer said "money" three times in two sentences. Grep verifies presence and
absence; only reading verifies that it is any good.

---

## 7. The footers

Five footers each held a left/right pair — `Sprig · A field guide to money` on
one side and a cryptic tag on the other: `Ed. 03 · Winter`, `Anonymous · Free ·
UK · Ages 13–14`, and `V1` on two pages. "Edition 03, Winter" describes a
magazine that does not exist; `V1` a version nothing increments.

All five now carry the single centred line, `justify-between` becoming
`justify-center`. Removing the `V1` tags was outside the original request and
was flagged as such rather than slipped in — the reason to raise it is that
consistency across pages was the actual goal, and leaving two pages with a tag
would have half-done it.

---

## 8. The avatar picker layout

Numbers, since "cramped" is not actionable:

| | before | after |
|---|---|---|
| panel width | 316px | 392px |
| shape target | 36px | 52px |
| shape glyph | 32px | 44px |
| colour target | 28px | 38px |
| colour swatch | 20px | 28px |
| grid gap | 6px | 10px |
| preview avatar | 56px | 64px |

The colours also moved from a flex row to `grid-cols-6`, so they line up under
the leaves above them instead of bunching left.

Worth noting the accessibility angle: a 28px colour swatch is below the ~44px
touch target that mobile guidelines ask for, and eight leaf shapes at 36px were
genuinely hard to tell apart — which defeats the point of offering eight.

---

## 9. How this was verified

Nothing here has a test, so everything was checked in the running app.

- **Leaves.** Deep-linked into a single subtopic (`/lesson?topic=…&subtopic=…`)
  rather than the full topic, which shortens the step list from 39 to 10 and
  makes the plant reach each stage in a few clicks. Checked stage 0
  (cotyledons), stage 2 (one leaf, left of stem) and stage 3 (two leaves, both
  sides) — the left and right leaves are the two *sign cases*, so confirming one
  of each proves the fix rather than half of it.
- **Favicon.** XML parse check, plus a throwaway page in `public/` rendering it
  at 16, 32 and 128px side by side. The 16px render is what showed the mark was
  swimming in empty margin, which is why the viewBox ended up cropped to
  `1 2 23 23` — the artwork only spans x 1.7–23.5, y 4.6–23. That temporary file
  was deleted afterwards.
- **Everything else.** `tsc -b --noEmit` and `npm run build` clean; a grep sweep
  for removed strings; and the picker, Landing copy and footer read on screen.

The pattern across the session: **the check that found things was never the one
that felt sufficient at the time.** The leaves looked fine in code review and
were backwards on screen. The favicon looked fine on screen and was malformed to
a parser. Reaching for a different *kind* of check than the one you just ran is
most of what verification is.

---
---

# Part two — the journey tree's three canopies

Separate piece of work, same day. Commit `1c178d3`, one file, +281/−46.

The upper half of the journey tree had gone wrong: the three canopies —
Application, Mathematics, Mastery — read as one dark mass rather than three
crowns, and several labels were sitting on the wrong foliage. Five things were
reported. **Two of them turned out not to be what they looked like**, and
finding that out is most of what this half of the log is about.

---

## 10. Measure the complaint before believing it

The five reported problems were: identical canopy colours, labels with poor
contrast and overlaps, canopies merging into one blob, padlocks off-centre, and
section headings at inconsistent heights.

Three were real. Two were not — and *neither was imaginary either*. In both
cases something was genuinely wrong on screen; the eye had just attributed it to
the nearest plausible cause.

**Padlocks.** Reported as "several float slightly off-centre". Measured, every
one of them was centred:

```js
// bounding box of the lock glyph vs the cx/cy of its node disc
{ dx: 0, dy: -0.15 }   // ...out of a glyph 12.7 units tall
```

Under a tenth of a pixel at render scale. So what was the eye seeing? Two
things. First, **locked discs on a canopy were filled with a green shade**
regardless of which canopy they sat on — invisible while all three canopies were
green, conspicuous the moment Mastery went brown, and a foreign-coloured disc
reads as a thing sitting *on* the surface rather than *in* it. Second, a real but
different geometric fact:

> A padlock's body is a filled-width rounded rect sitting entirely below the
> centre line; the shackle above it is a thin open arc. Weight each shape by the
> length of stroke it puts on the page — about 34 units against 14 — and the ink
> centres roughly 0.6 units BELOW the node centre, even though the bounding box
> is dead centre.

**The eye centres mass, not bounding boxes.** That is why icon sets carry
hand-tuned optical offsets. The glyph is now lifted by that 0.6.

**Section headings.** Reported as sitting at inconsistent heights. All three
share `y=62`, and `getBBox()` agreed to the pixel:

```
Application  baseline 62, box 37.2 → 68.2
Mathematics  baseline 62, box 37.2 → 68.2
Mastery      baseline 62, box 37.2 → 68.2
```

The misaligned thing was the **numeral disc** below each heading: II and III at
`cy=121`, IV at `cy=144`. The reader takes heading-plus-disc as one unit, so a
low disc reads as a low heading. Moved to 121, with the Mastery limb's tip
raised from y=162 to y=139 so the branch still runs into the disc instead of
stopping 20 units short of it.

**The lesson.** A bug report is a description of a *symptom*, and the reporter's
guess at the cause is data, not diagnosis. Both of these would have been
"fixed" by nudging the thing that was named — and the nudge would have made a
correct thing wrong while leaving the actual defect in place.

---

## 11. The real find: correct in every state, wrong as a function of data

This is the one worth reading twice.

The canopies overlap by 150–200 units, and all fifteen labels are painted
*after* all three canopies. So whichever canopy is drawn last wins the overlap,
and any label underneath it ends up on a neighbour's foliage. That much is
ordinary z-order.

The problem was **which canopy is drawn last**:

```tsx
{[...canopyTiers]
  .sort((a, b) => Number(grown(a.tier)) - Number(grown(b.tier)))
```

Dormant first, grown last — so the branch the student had actually reached came
forward instead of being buried. A good intention, and it reads well.

But `grown(tier)` is **a function of the student's progress**. So the paint order
is a function of the student's progress. So which labels are legible is a
function of the student's progress. Measured on one account, same code, same
labels, only the progress rows differing:

| student state | "Simple Interest" on the wrong canopy |
|---|---|
| tiers 1–2 done, 3.5 current | **0%** |
| no progress at all | **68%** |

Nothing in the file said so. There is no state in which the rendering is
*wrong* — for any given student it does exactly what it was told. It is wrong
only across states, and only if you happen to look at more than one.

**Why this class of bug is nasty.** You cannot catch it by reading the draw
code, because the draw code is correct. You cannot catch it by looking at the
screen, because the screen is correct. You catch it only by rendering the same
component against *different data* and comparing — which is why the seeded
account below mattered more than any amount of staring.

The fix is to make the order a constant:

```tsx
const CANOPY_PAINT_ORDER = [4, 2, 3];   // Mastery, Application, Mathematics
```

Mathematics goes on top because it is the middle crown and overlaps both
neighbours, so burying it would cost twice.

**What it costs.** The "my branch comes forward" cue. That was worth having when
all canopies were the same colour and z-order was the only thing distinguishing
them. It is worth much less now that each tier has its own tone, which tells you
both which crown you are looking at *and* whether it is in leaf — strictly more
information than depth was carrying.

**What it buys.** Every student sees the same drawing. That is what makes the
label positions tunable at all: tune once, stays tuned. A layout you can only
verify per-student is a layout you cannot verify.

---

## 12. One token per tier, and the contrast ceiling

The canopy palette was four constants — a grown pair and a dormant pair — shared
by all three tiers. So any two canopies in the same state were *the same
colour*. At the start of the course all three are dormant, which is the worst
case: the entire upper half of the drawing is one near-black shape, and the only
thing naming each branch is a small italic header above it.

Each tier now carries its own pair, separated on two axes at once. Measured off
the rendered fills, dormant:

| tier | oklab lightness |
|---|---|
| Application | 0.448 |
| Mathematics | 0.343 |
| Mastery | 0.250 |

Roughly 0.10 apart, plus a hue shift — Application pulled toward terracotta,
Mastery toward ink, Mathematics left on the raw token. **Lightness alone reads
as one colour lit unevenly; the hue shift is what makes them read as three
different plants.**

The spread stops at 0.10 per step for a reason worth stating, because it is the
kind of constraint that looks like timidity until you know it:

> Canopy labels are cream text sitting *directly* on the foliage. So the
> LIGHTEST of the six fills still has to be dark enough to carry cream. That
> caps the top of the range near 0.48. The bottom is capped by not turning
> Mastery into a hole in the page. Widening past this means giving up either
> the contrast or the family resemblance that makes all three read as foliage.

Same shape of problem as the avatar tokens in part one: a colour's value is set
by its *job*, and when two jobs conflict the answer is more tokens, not a
compromise value.

---

## 13. A cream separator that erased its own labels

The seam between crowns was a 5-wide stroke in `var(--background)` — the page's
own cream. The reasoning is sound: a background-coloured outline separates two
overlapping shapes without inventing a border colour.

It also paints a 5-unit **cream band through whatever is underneath**. And the
canopies are painted in one pass, all fifteen labels afterwards on top. So a
label belonging to the canopy *below* could land on the cream band of the canopy
*above* it — cream text on a cream stroke, gone.

A dark edge cannot do that. Whatever crosses it stays legible, because the whole
premise of the canopy palette is that cream reads on it. Now `--ink`-based and
7 wide.

Note the shape of this bug: the stroke was doing its job perfectly on the
element it belonged to, and doing damage to an element three hundred lines away
that it had never heard of. **A background-coloured anything is a hole punched
in everything beneath it**, and that is easy to forget when the thing beneath is
drawn by different code at a different time.

---

## 14. A fix that was correct and still had to be reverted

The principled fix for labels-on-the-wrong-canopy is to stop each canopy
painting over the others' label boxes at all — mask them out, let the label's
own foliage show through, and the result no longer depends on draw order.

Implemented with an SVG `<mask>`: a white full-canvas rect, minus a black
rounded rect per foreign label box. It worked exactly as designed, and it looked
like a rendering glitch — clean rectangular steps bitten out of a hand-drawn
silhouette, which pulls the eye far harder than the overlap ever did.

Second attempt: ellipses instead of rects, on the theory that a curved scallop
passes for the gap between two clumps of leaves. That was worse, and it exposed
the flaw in the whole approach:

> **Different tiers' label boxes overlap each other in space.** So subtracting a
> *foreign* tier's box also strips canopy from under the tier's *own* labels —
> and what shows through there is not a neighbour's foliage, it is the cream
> page. The fix for "cream text on the wrong green" produced "cream text on
> cream", which is the strictly worse failure.

Reverted both. The lesson is not "don't try things" — trying it is how the
overlap between label boxes got discovered at all. It is that **a fix which
satisfies the stated requirement can still be worse than the bug**, and the only
way to know is to render it and look.

*(A footnote on the revert itself: it was done by slicing the file between two
text anchors, and `organicBlob` happened to sit between them, so it went too.
`tsc` caught it instantly — three "Cannot find name" errors. Restored from
`git show HEAD:` and diffed to prove it was byte-identical. Anchor-based edits
are fine; anchor-based **deletions** need you to know what is in the middle.)*

---

## 15. What actually fixed the labels, and what was left alone

With paint order fixed, the remaining collisions could be tuned once. Four
canopy nodes moved and three `yMax` clips were retuned:

| label | area on the wrong tier's foliage |
|---|---|
| I.V "Setting a Goal That Actually Matters to You" | 28% → **7%** |
| II.I "Budgeting Basics" | 48% → **5%** |
| II.II "How Pricing Tricks You" | 18% → **0%** |
| label-vs-label collisions | 1 → **0** |

`r1` is the interesting one, because it is **wedged between two constraints**:

- It is the lowest Mastery node, and `organicBlob` never trims a canopy below
  the support distance of its content — so `r1`'s box is what sets how far that
  crown may be clipped. Too low, and the crown reaches the trunk's dark-ink
  "Setting a Goal…" label, which is drawn for cream paper.
- Too high, and `r1`'s own two-line label prints through `r2`'s above it. At
  y=524 "Budget Calculator (Python)" ran straight through "The Real Compound
  Interest Formula".

y=545 is the gap between them. Thirteen units of travel, with a wall on each
side.

**The residual was left in.** 7% / 5% / 2% is corner-grazing at label edges.
Removing it entirely needs the three node clusters given non-overlapping
horizontal bands, which needs a wider viewBox and every element rendering about
6% smaller — a real trade, and the kind of call that belongs to whoever owns the
design rather than to whoever is fixing the bug. Recording *why* a known
imperfection is still there is part of the job; a number in a log is cheaper
than rediscovering the constraint in six months.

---

## 16. How this was verified

The component takes a `journey` prop and nothing else, which is what made this
testable at all. A script seeded one test account to a chosen progress shape,
and the same measurement ran against each:

1. **All three dormant** — a student who has just started. The original
   complaint state.
2. **One grown, two dormant** — Application in leaf, the rest not.
3. **Two grown, one dormant, one topic current** — the mixed state asked for.

The measurements were taken from the live DOM rather than by eye, because "does
this label sit on its own canopy" is not a question eyes answer reliably:

- `isPointInFill()` on each canopy path, sampled across each label's box, to ask
  **which canopy is painted on top at this point** — not merely which canopies
  contain it, which was the first and wrong version of this check.
- `getBBox()` on every text node, grouped by owning node, for label-vs-label
  collisions. Grouping mattered: ungrouped, a node's own numeral and its own
  wrapped second line register as "overlaps", and the real signal drowns.
- `getBBox()` on each lock glyph against its disc's `cx`/`cy`.
- `getComputedStyle().fill` on each canopy, to check the tones landed where the
  palette said rather than where the source said.

States 1, 2 and 3 returning **identical** residuals is the actual proof that the
paint-order fix worked. Before it, the same measurement returned different
numbers for each — which is how the bug was found in the first place.

---

## The thread running through both halves

Part one ended on *the check that found things was never the one that felt
sufficient*. Part two is the same idea one level up.

The leaves were wrong in a way you could see. The favicon was wrong in a way
only a parser could see. The paint order was wrong in a way **neither the code
nor the screen could show you** — only the same code, rendered against different
data, put side by side.

Each of those needs a different instrument. Reading harder does not substitute
for any of them.
