# Technical log — 24 August 2026

## What was built

Four commits, all on the journey tree:

| commit | what |
|---|---|
| `dee1018` | a seven-item design pass — leaf termini, colour, outlines, spacing, the trunk junction, the Essentials label, scale |
| `51ae7fb` | four fixes found by testing that pass at two progress states |
| `cc77e3b` | canopy colours fixed permanently; the grown/dormant distinction removed |
| `51dbf55` | limb colour, the Essentials label, and two overlapping labels |

The interesting material is in the second and fourth. Two of `51ae7fb`'s fixes
turned out to be the *same kind of bug* wearing different clothes — an
approximation whose error had a direction, and nobody had asked which direction
was safe. `51dbf55` then produced its sharper cousin: a measurement pointed at
the wrong object entirely. Those get the longest sections.

---

## 1. A terminus instead of a floating marker

Each canopy's lesson chain used to run through five nodes and simply stop, while
a separate circular disc carrying the tier numeral floated above the foliage
with the branch running up behind it. The disc knew nothing about the chain.

Now the chain ends in a leaf. Three things had to happen together:

- A **crown position** per tier, appended to the node list when the path is
  drawn, so the line runs continuously through all five lessons and up into the
  leaf.
- The crown fed into **`tierPoints`**, so the canopy grows to contain it.
- The path fraction **rebased on segments rather than nodes**.

The middle one is the one that would have bitten. The canopies are generated
from the boxes they must cover, so a crown left out of that calculation sits
above foliage that never grew to meet it — which is precisely the 37 units of
bare limb that showed up as a "stray line" out of the Mastery milestone the day
before. The leaf is a much bigger object than that disc was, so the same
omission here would have left a much bigger hole.

The third is a smaller trap. The chain was `start -> n1..n5` and a fraction of
`completed / 5` filled it exactly. Appending the crown adds a sixth segment, so
`completed / 5` would light the whole line while the final stretch into the leaf
stayed dim — the leaf sitting on an unlit stub at 100%, which is the one moment
it most needs to look finished.

**Tier I keeps its circle.** It is the trunk's *origin*, not a terminus, and a
leaf there would say the trunk stops at it when it carries on downward.

---

## 2. A fix that was only half a fix

The three branches left the trunk within five units of each other — `408`, `411`
and `413`, all at `y = 606` — and immediately fanned out, so the junction was a
knot of crossing edges with no trunk visible between them.

Staggering their origins down the trunk was the obvious fix and it was not
enough. The tangle came back slightly lower, because **the lesson chains had not
moved with them**: all three still radiated from a single shared `FORK` at
`[410, 568]`. So three paths fanned out of one point while three branches fanned
out of three others, and the crossings between the two sets rebuilt the knot.

Each chain now starts at its own limb's origin, so the drawn line *continues*
the branch rather than crossing it.

**The concept.** When one drawing has two systems that are supposed to describe
the same thing — here, a filled tapered limb and a stroked path along the same
route — moving one and not the other does not half-fix the problem. It can leave
it exactly as bad while looking like progress, because the thing you changed did
move.

---

## 3. Two estimates, both wrong in the direction nobody checked

This is the section worth keeping.

Item 2 of the four fixes was "the Mathematics canopy's outline crosses its own
subtopic text". Two independent causes, and they are the same bug twice.

### 3a. An estimate that was only safe in one direction

Each canopy is grown around a box per node, and the box's width comes from a
per-character estimate:

```ts
const CHAR_W = 8.2;
const w = Math.max(...text.map((t) => t.length)) * CHAR_W + 12;
```

The comment above it said, in as many words, that an estimate was fine here
because it only pads a decorative silhouette and does not align anything.

That is true — **but only if the estimate errs long.** Measured against the
rendered glyphs:

| label | chars | estimated | real | per char |
|---|---|---|---|---|
| Scams & | 7 | 57.4 | 65.4 | **9.35** |
| Why Some Choices | 16 | 131.2 | 146.4 | 9.15 |
| The Real Compound | 17 | 139.4 | 154.1 | 9.06 |
| Inflation Basics | 16 | 131.2 | 116.0 | 7.25 |
| Intuitively | 11 | 90.2 | 75.2 | 6.83 |

Real width runs from 6.83 to 9.35 per character depending on which letters are
in the string. At 8.2 the wide ones were up to fifteen units wider than the box
their canopy was grown around — so the canopy was drawn around a box narrower
than the text, and the text stuck out through its own contour.

`CHAR_W` is now 9.4, which clears the worst case. Narrow labels get a box wider
than they need, costing a little canopy area and nothing else.

**The concept: when an approximation's failure is asymmetric, the approximation
should be biased.** Erring long here is invisible. Erring short is a visible
defect. An "average" was exactly the wrong statistic to pick; the maximum was
the right one, and the word "average" in the original comment is where the bug
actually lived.

### 3b. A smoothing pass with no floor

Raising `CHAR_W` did not fix it on its own, and `pad` — the obvious lever, the
clearance between the boxes and the contour — did nothing at all no matter how
far it went up. That is the tell that something downstream was eating it.

`organicBlob` builds each canopy from a support function: for each of 42
directions, how far the furthest content point projects. It pads those radii,
then smooths them with a small kernel so the contour stops looking like a cut
gem:

```ts
const kernel = [1, 3, 5, 3, 1];
const smoothed = raw.map((_, i) => { /* weighted average of neighbours */ });
```

An average moves a value **toward** its neighbours. So in any direction where
the support is a *local maximum* — which is exactly what a label corner
protruding past its neighbours is — the smoothed radius comes out **lower than
the raw one**, and the contour is pulled inward, into the content it exists to
contain. And it does that hardest at precisely the directions that need the
clearance most.

That is why `pad` was useless: smoothing was eating the padding wherever it
mattered and leaving it wherever it did not.

The fix is one line, and the reasoning behind it was **already written in this
file**:

```ts
return Math.max(sum / weight, support[i] + MIN_CLEARANCE);
```

Here is the part that stings. `organicBlob` already had a guard for this exact
failure, three lines below, applied to the *wobble* rather than the smoothing:

> `outward` clamps the wobble to >= 1. The sine terms swing about +-12%, so on
> a downswing they pull the contour INSIDE the padded hull — and a label near
> the edge ends up half off the foliage.

Same principle, same consequence, same file. It had been discovered, understood,
written down in capitals — and scoped to the single operation that prompted it.
The smoothing sat directly above, doing the same thing, unguarded.

**The concept, and it is the general one.** A guard that documents a principle
but is applied only to the instance that revealed it is a latent bug with a
comment explaining it. When you write "X must never pull the contour inside the
content", the next question is not "is this X fixed" but **"what else in this
function can move that number?"**

Result: labels touching their own outline went **9 to 0**.

### What the two have in common

Both are numbers that were approximately right, where the *sign* of the error
mattered and nobody had asked which sign was safe:

- `CHAR_W` was an average where the safe direction was up.
- Smoothing was a mean where the safe direction was outward.

Neither is visible in a screenshot at a glance — a label grazing its outline by
one sample in seventy-five is a hairline. Both are trivially visible to
`isPointInStroke`. The measurement that found them is three lines long and
should have existed before either bug did.

---

## 4. The leaf was narrower than the number that sizes it

Item 4 was "the Roman numerals do not fit inside their leaves". The obvious read
is that the font is too big.

Measured:

```
CROWN_W (the constant)      46
leaf as actually rendered   34.5      <- 75% of it
numeral "III"               27.0
```

The teardrop is drawn as two symmetric cubics from a tip down to a rounded base,
and **the control points pull its widest point in to about three quarters of
`CROWN_W`**. So the constant that reads like "the width of the leaf" is not the
width of the leaf. Sizing the numeral against 46 while the shape was really 34.5
left under four units of padding a side — and less than that at the height the
text actually sits, because the leaf is still narrowing there.

Leaf up to 62 (renders 46.5), numeral down to 17. Padding is now 12.2 to 15.6 a
side.

**The concept.** A constant named for a dimension is not a measurement of that
dimension once a curve is involved. If a shape is defined by control points, the
only honest width is the one `getBBox()` reports.

---

## 5. A colour pendulum, and why both swings were right

Worth recording as a sequence, because in isolation each step looks like undoing
the last:

| pass | grown chroma | dormant chroma | why |
|---|---|---|---|
| 23 Aug | 0.050–0.062 | 0.017–0.021 | first light palette |
| 24 Aug, design pass | 0.024–0.030 | 0.009–0.011 | "too saturated, reads childish" |
| 24 Aug, fixes | 0.036–0.042 | 0.014–0.016 | "dormant is flat grey, loses the botanical feeling" |

The middle row is not a mistake that the third row corrects. Pulling the whole
family down was right — the first version read as three strong colours rather
than one calm palette. But it took dormant down with it to about 0.010, which is
grey in all but name, and the tree *before a student starts* stopped looking
like a plant waiting to grow.

Restoring hue to dormant then costs the grown/dormant contrast, which is the
thing that makes the branch a student is actually on stand out. So grown went up
in the same move, and the two are now separated by **2.5x in chroma plus 0.025
in lightness** while both stay well below the saturation that read as childish.

**The concept.** When a global adjustment fixes one end of a scale and breaks
the other, the fix is usually not to reverse it but to *re-spread* the range
underneath it. Recording the sequence matters, because the third row looks like
a straight reversal of the second and is not.

---

## 6. Regressions I introduced, and caught

Two, both from widening the tree's column from `lg:col-span-8` to `9` and
shrinking the sidebar to `3`:

- **Tier and Chapter collided.** The stat grid had `gap-y-7` and no column gap;
  at the old width nothing touched, at the new one "Application" ran straight
  into "IV of V". Now `gap-x-6`.
- **"32 / 80" broke after the slash**, reading as two numbers. Fixed with
  `whitespace-nowrap` — and then immediately scoped away from the accent stat,
  which is the *Next subtopic title*: free text that must stay free to wrap, or
  a long title would push out of the sidebar instead of onto two lines.

The second fix creating the need for the third is the ordinary shape of this
work. Worth noting only because the overflow it would have caused depends on
content nobody has written yet — a subtopic title longer than any that currently
exists — so it would not have shown up in any amount of looking at today's page.

---

## 7. Everything else in the design pass

Briefly, since none of it was surprising:

- **Outlines** 5 to 2.5 and softened toward cream — the shapes read as drawn
  rather than as cartoon blobs.
- **Spacing** `LABEL_GAP` 42 to 52, `LINE` 23 to 26, numeral offset -7 to -15.
- **Tier headers** lifted; measured gaps to the foliage below went from
  18 / **0** / 14 to 62 / 38 / 64. Mathematics stays smaller than its
  neighbours and that is deliberate: its crown sits highest and cannot drop
  without colliding with `m5`'s two-line label.
- **Essentials** moved out to `x=196`, clear of the trunk's lesson titles, so it
  reads as a section heading like the three canopy headers rather than as one
  more label.
- **Scale** — column widened and canopy padding raised, so the tree renders
  larger *and* has more internal air rather than trading one for the other.

---

## 8. The viewBox, re-fitted four times

Once per geometry change, and that is not carelessness — it is the dependency
the 23 August log already recorded, exercised repeatedly:

> THESE TWO NUMBERS ARE DOWNSTREAM OF LABEL_GAP AND LINE.

Today it was downstream of `LABEL_GAP`, `LINE`, `CROWN_W`, `CROWN_H`, the
canopy `pad`s, `dx`, `CHAR_W`, and the crown leaves entering `tierPoints`. Every
one of those changes the artwork's bounding box, because the canopies are
generated from the content and the frame is fitted to the canopies.

The discipline that made it cheap: **fit the viewBox last, from a measurement,
never from an estimate.** Each re-fit was one probe and one edit.

---

## 9. Verified at three states

Same protocol as the previous two sessions — low, mixed and full, on a real
account:

| state | clipped | own outline | label pairs < 9 units | fruit outside |
|---|---|---|---|---|
| 4/80 | no | 0 | 0 | 0 |
| 32/80 | no | 0 | 0 | 0 |
| 80/80 | no | 0 | 0 | 0 |

Two residuals left in deliberately, both with reasons recorded in the commit
message:

- **Mathematics' header gap is 38** against 62 and 64. Its crown sits highest
  and cannot drop without colliding with the two-line label below it.
- **Labels grazing a neighbouring crown's edge** — seven of them, one or two
  samples each, plus three sitting 16-18% on a neighbour's fill. Inherent to
  three crowns that overlap by design, and slightly worse than yesterday
  precisely *because* the honest `CHAR_W` made every canopy wider. Removing it
  needs the clusters pulled apart and a wider viewBox, which would spend the
  scale increase this pass just bought.

---

## 10. Deleting an encoding, and letting the compiler check you finished

Late in the day the canopy colours were fixed permanently at their saturated
values, with the grown/dormant distinction removed entirely. A brand-new
student now sees the same drawing a finished one sees.

The brief named colour. The honest reading was wider, because **five other
things were also keyed to progress**:

- the highlight lobe, which appeared only once a tier was reached — so each
  crown visibly changed shape as a student advanced
- the crown leaves, outlined until a tier was finished and filled after
- the fruit, revealed one per completed topic
- the trunk leaves, same reveal
- the ring inside the Tier I hub

All fixed. Only the node icons and the lit portion of the path move now.

**Why this is not a loss of information.** Progress was encoded three times
over: node icons (check versus padlock), path lighting, and colour. The third
copy cost the tree its colour for the entire period a student is most likely to
be forming an impression of it — the beginning — in exchange for a fact that
was already on screen twice.

### The compiler as the completeness check

The satisfying part came after. With colour no longer reading progress,
`grown()` and `tierComplete()` had no callers left and `tsc` said so:

```
error TS6133: 'grown' is declared but its value is never read.
error TS6133: 'tierComplete' is declared but its value is never read.
```

Those two errors are the evidence the encoding was fully removed. Had either
survived, something downstream would still have been consuming progress for a
purpose that was meant to be gone — and the natural instinct on seeing an
unused-variable error is to silence it, which would have hidden exactly the
signal worth reading.

What remains is one caller of `completedInTier()`, the path fraction. That is
the invariant now, and it is a much easier one to keep than "remember not to
key decoration off progress": **progress reaches the drawing through node
status and through one number, and nowhere else.**

**The concept.** When you remove a capability, the question is not "does it
still build" but "what became dead?" Live leftovers mean the removal was
partial. Dead ones are the proof it was not.

### Verifying an absence

"The colours must not change" is a claim about a *non-difference*, which is
awkward to check by eye — three screenshots that look similar prove very little.

So every non-node visual was serialised and hashed: canopy fills and strokes,
shade lobes with their opacities, crown leaf fills and strokes, numeral fills,
every fruit coordinate, trunk leaf count. One account, three progress states:

```
4/80    hash 3807029625    1 check,  18 locks, no lit path
32/80   hash 3807029625    8 checks, 11 locks, one path lit to 0.5
80/80   hash 3807029625   20 checks,  0 locks, three paths lit to 1
```

Same 913-character fingerprint three times, with only the progress figures
moving. That is a claim about sameness stated in a form that can actually fail.

---

## 11. A colour bug that was a paint-order bug — and a probe that lied

The report: the limb running from the trunk to the Application canopy is a
lighter green than the other two.

All three limbs are `fill={LIMB_FILL}`, one constant, `var(--forest)`. The DOM
agreed — identical computed fills, opacity 1, on all four limb paths. So the
question was never "why is this one a different colour" but **"what is on top of
it?"**

`elementFromPoint`, walked along each limb's centreline, answered immediately:

```
applicationLimb (340,540)  path fill=oklch(0.828 0.044 167)
applicationLimb (300,500)  path fill=oklch(0.828 0.044 167)
applicationLimb (260,462)  path fill=oklch(0.828 0.044 167)
```

That value is the *Mathematics* shade lobe. Limbs are drawn before the canopies,
and the Application limb happens to pass under the Mathematics crown for most of
its length between the trunk and its own canopy. The branch was not a different
shade. It was buried, and what showed along it was a neighbour's foliage.

The fix is to draw the three limbs again *after* the canopies, masked to the
region outside every crown:

```tsx
<mask id="sprig-outside-canopies" maskUnits="userSpaceOnUse" ...>
  <rect ... fill="white" />
  {canopyTiers.map((c) => <use href={`#sprig-canopy-shape-${c.id}`} fill="black" />)}
</mask>
<g mask="url(#sprig-outside-canopies)">{branches}</g>
```

The mask is the part that matters, and it is what makes the change safe: inside
a crown the second pass is removed entirely, so foliage, lesson paths and
everything else inside a canopy are untouched. The fix reaches exactly the
segment that was wrong and no further. Each canopy now publishes its silhouette
under an id so both its own clip and this mask can reference the same shape.

### The probe that over-reported

Checking the result, a new test asked "does any label sit on a limb?" and named
three:

```
III.I Percentages in Real Life : 15 / 75 samples
III.II Simple Interest         :  1
IV.II The Real Compound        :  2
```

Fifteen samples out of seventy-five is 20% of a label — alarming, and it would
have sent me moving a node that did not need moving.

It was the test that was wrong. `isPointInFill` answers *"is this point inside
this shape"*, which is a question about geometry. It says nothing about whether
the shape is **painted** there — and after the masking change, a limb under
foliage is removed at render time. "Percentages in Real Life" sits inside the
Mathematics canopy, where the Application limb beneath it is masked away and
invisible.

Counting only points that are on a limb **and** outside every canopy gives zero,
across all three progress states.

**The concept, and it is the sharper cousin of section 3's.** Section 3 was
about an estimate whose error had a direction nobody checked. This is about
measuring the wrong object entirely: a query against the geometric model is not
a query against the rendered result, and the gap between them is exactly the
compositing — masks, clips, paint order, opacity — that this file is full of.
When a probe and a screenshot disagree, the screenshot is not automatically
right, but the probe has to be able to say which question it answered.

### The two labels, for the record

- **I.V "Setting a Goal That Actually Matters to You"** had the Mastery limb
  running diagonally through it, 6% of the label on the limb. At 174 units wide
  the label sits squarely in the corridor, so no lower departure could miss it;
  the limb now leaves the trunk *above* it, at y=570 instead of 640.
- **III.II "Simple Interest"** ran x=465 to 580 on the right, which put it over
  the Mathematics and Mastery crowns at once and across the lesson path. Flipped
  to the left and lifted clear of the node below.

And **Essentials** moved to the right of the trunk at y=840 — the one band where
that side is free, since the trunk labels alternate and t3's ends at 789 while
t1's begins at 881. Measured 33.5 units to the nearest label. `TierHeader`
gained a `start` anchor, and its underline now spans the measured glyphs from
whichever end the text is anchored.

---

## The thread

Three groups today, each needing a different question.

**The morning's design pass** was mostly ordinary work, with one trap: a fix
that only half-fixed, because moving the limbs without moving the chains left
the tangle intact while looking like progress.

**The afternoon's four fixes** were about approximations whose error had a
direction nobody had checked:

- `CHAR_W` was an average. The safe direction was up.
- Smoothing was a mean. The safe direction was outward — and the rule was
  already written in this file, applied to the neighbouring operation and not
  this one.
- `CROWN_W` was a control-point parameter being read as a width; the shape
  rendered 25% narrower than the number naming it.

**The evening's two commits** were about measuring the wrong object:

- The "lighter" limb was the same colour as its neighbours, with something
  painted over it.
- The probe that found three labels on a limb was asking about geometry when
  the question was about what is visible.
- And the claim that most needed proving — *these colours do not change* — is a
  non-difference, which no screenshot can establish and a hash can.

Reading the code harder finds none of these. Each needs a specific instrument,
pointed at the specific object the claim is actually about.
