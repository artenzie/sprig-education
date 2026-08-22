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
