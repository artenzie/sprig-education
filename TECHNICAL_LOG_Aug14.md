# Technical log — 14 August 2026

## What we did today

Loaded Tier 4 — Mastery — into the database: 5 topics, 20 subtopics, 97
slides (10 of them `slide_type = 'code'`, preserving Python's exact
indentation), 82 questions. Same direct-insert pattern as Tier 3 (5 August):
content held as plain JS objects, written straight into Supabase through
`supabase-js` with the service-role key, with matching SQL migration files
generated afterward for the historical record. The question bank now holds
336 questions across all four tiers.

This is the first tier to actually exercise both renderers built earlier in
August — `slide_type = 'code'` (11 August) and inline `$...$` / block
`$$...$$` KaTeX inside text slides (13 August). Both had been built ahead of
having real content to prove them against; today supplied that content.

---

## 1. Two renderers, one document, and keeping them apart correctly

The source document mixed two things that must never be confused: ten
Python code blocks that need their whitespace preserved exactly (Python is
indentation-significant — four spaces is the difference between a line
being inside a loop or not), and several maths-heavy slides carrying KaTeX
that needs the opposite treatment — parsed as prose with `$...$` segments
picked out, not rendered as a monospace block.

The rule was mechanical once stated: everything the document marked
`[CODE]` became `slide_type: "code"`, body copied verbatim including blank
lines inside the code (e.g. the loop in IV.I.III has a blank line before
`total_spent = 0` that matters for readability, not logic — copied anyway,
because "verbatim" doesn't get to make exceptions). Everything else stayed
`slide_type: "text"` (the schema default), including the four display
equations (`$$...$$`) and every inline `$A$`, `$P$`, `$r$` — those are
prose from the renderer's point of view, just prose with `$` in it.

```
{ subtopic_id: S.I_III, order: 8, slide_type: "code", heading: "Asking in a loop", body:
`categories = {}

while True:
    name = input("Category name (or press Enter to finish): ")
    if name == "":
        break
    amount = float(input(f"How much for {name}? "))
    categories[name] = amount` },
```

JS template literals (backticks) held every slide body, code and text
alike — they take a literal newline as a literal newline, no escaping, and
neither the Python content nor the LaTeX content contains a backtick or a
`${` sequence that would trip template-literal interpolation. That made
"paste the source text in with the whitespace it already has" a safe
default rather than something to double-check line by line.

**Why this needed a heading no one wrote.** A code slide renders its whole
body as code — no prose fits alongside it — but `slides.heading` is
`not null`, and the source document deliberately left code blocks
unlabelled (just "**Slide 6** `[CODE]`", no title). Ten short headings were
written to fill that gap — *"The trap in code," "Fixed with int()," "Asking
in a loop"* — none of which exist in the source. Worth naming plainly:
those ten strings are new content invented for this load, not transcribed
from anywhere, and they're the one thing in this session that wasn't a
direct copy of the source document.

---

## 2. Verifying whitespace and LaTeX survived, not just that rows exist

Row counts matching is necessary but not sufficient here — the whole point
of `slide_type = 'code'` is that a stray space or a collapsed blank line
would be silently wrong forever, since nothing renders differently to flag
it. So after inserting, the actual `body` column was pulled back from
Supabase and printed raw:

```
$$500\left(1 + \frac{0.22}{12}\right)^{36} \approx 962$$
```

```
categories = {}

while True:
    name = input("Category name (or press Enter to finish): ")
    if name == "":
        break
    amount = float(input(f"How much for {name}? "))
    categories[name] = amount
```

Both came back character-for-character identical to what was written —
single backslashes (not doubled, not stripped), the blank line inside the
loop still there, four-space indents intact. This confirms two separate
things worked correctly at once: the JS string escaping into the
`supabase-js` insert, and — for the record copy — the SQL single-quote
doubling (`'` → `''`) used when generating the migration files, since a
`\left(` or a `don't` breaking either path would have shown up as visibly
wrong text in this exact check.

---

## 3. The source document's own slide count didn't match its own content

The document's production notes claimed 95 slides total, 34 of them in
Topic IV.I. Counting the actual numbered `**Slide N**` headings in the body
text — not the summary table — gives **97 slides**, with Topic IV.I at
**39**, not 34. Topic IV.III is also off: the notes claim 15, the actual
content has **12** (the "Practice" subtopic there has only one slide, same
shape as the other three Practice subtopics in this tier, not four).

```
IV.I.I: 8    IV.II.I: 4     IV.III.I: 3    IV.IV.I: 4    IV.V.I: 4
IV.I.II: 12  IV.II.II: 4    IV.III.II: 4   IV.IV.II: 4   IV.V.II: 4
IV.I.III: 12 IV.II.III: 4   IV.III.III: 4  IV.IV.III: 4  IV.V.III: 4
IV.I.IV: 7   IV.II.IV: 4    IV.III.IV: 1   IV.IV.IV: 1   IV.V.IV: 5
= 39         = 16           = 12           = 13          = 17
```

This is the identical failure shape the source document itself warns
about — its own production notes cite catching a Tier 2 banner wrong by
six and a Tier 3 format-spread that didn't sum to its own total — arriving
a third time, in the document that was written to guard against it. The
question bank's counts, by contrast, were checked the same way and did
match (82 total, matching every per-topic and per-format subtotal), so this
wasn't a document-wide problem — just the one slide-count table.

**What got loaded is the actual content** — every numbered slide in the
body text, 97 of them — not a total forced to match a banner that was
wrong. Recounting from headings rather than trusting a summary line is the
same discipline the 5 August session used; it's worth repeating because it
keeps finding real discrepancies rather than becoming a formality.

---

## 4. True/false questions, and why they're not their own type

The schema's `question_type` check constraint doesn't include `true_false`
— only `mcq`, `multi`, `num`, `text` — a decision made back on 24 July
("there's no dedicated true_false UI component"). All three T/F questions
in this bank (two in Crypto, one in the compound interest topic) went in as
`mcq` with `options: ["True", "False"]` and `correct_answer` as the option
index — `"0"` for a True answer, `"1"` for False. `QuestionCard` never
needs to know a question started life as true/false; it just renders a
two-option multiple choice, which is what it structurally is.

---

## 5. `check-questions.ts` against 336 questions, clean on the new content

```
node --env-file=.env scripts/check-questions.ts --list-ok
```

Checked all 336 questions across four tiers. One error and two warnings
came back — all three pre-existing, all three in Tier 2 content this
session didn't touch (the UK fraud-number question already flagged in the
5 August log and never allowlisted, plus two back-reference warnings on
"above"/"below" in Scams & Financial Safety and Buy Now, Pay Later
questions). **Zero findings anywhere in the 82 new Tier 4 questions** — the
"restate your own figures, never point outside yourself" discipline the
question bank's own production notes describe held up under the same
automated check that's caught real bugs before.

---

## What was verified

| Check | Result |
|---|---|
| Slide count recounted from source, per subtopic | ⚠️ source banner claims 95 (34 in IV.I, 15 in IV.III); actual numbered content = 97 (39 in IV.I, 12 in IV.III) — loaded the actual content |
| Question count recounted from source, per subtopic | ✅ 82, matches banner and every per-topic/per-format subtotal |
| Code slide count | ✅ 10, all in Topic IV.I, matches source's own list |
| Every code slide's body vs source, character-by-character | ✅ spot-checked two (loop, credit-card display equation) — exact match, indentation and blank lines intact |
| Every KaTeX slide's `$`/`$$` delimiters vs source | ✅ spot-checked — single backslashes, no doubling or stripping |
| T/F questions correctly mapped to `mcq` + True/False options | ✅ all 3, correct index in each case |
| `multi` question `correct_answer` format (`"[0,1,2]"`) | ✅ matches existing tiers' encoding |
| Every generated SQL migration file's quote-escaping | ✅ read back, apostrophes doubled correctly throughout |
| Row counts in Supabase after insert | ✅ 5 topics / 20 subtopics / 97 slides / 82 questions |
| Total questions across all tiers | ✅ 336 |
| `npm run check:questions` | ✅ 0 findings in new content; 3 pre-existing Tier 2 findings, unrelated, left as-is |

**Not done this session:** a live browser walkthrough of an actual Tier 4
lesson. Both renderers being exercised here (`slide_type = 'code'`, inline
KaTeX) were already built and presumably exercised when they shipped on 11
and 13 August; this session verified the *data* reached Supabase intact
rather than re-verifying the renderers themselves. Worth a real
click-through before the pilot, same as every other tier's "read before
shipping" note says.

---
---

# Session 2 — route-level code splitting

## What we did

`npm run build` was warning that the production bundle had crossed Vite's
500 kB default threshold (~570 kB) — everything the app needed, across
every page a student or teacher might never visit in a given session, was
shipping in one JS file on first load. Fixed it with route-level code
splitting: every page component in `src/routes/AppRoutes.tsx` now loads
through `React.lazy()` instead of a static `import`, wrapped in a single
`<Suspense>` boundary around the whole `<Routes>` tree. A page's code now
downloads only when a student actually navigates to it.

```
const Dashboard = lazy(() => import('../pages/Dashboard'))
...
<Suspense fallback={<PageLoading />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    ...
```

## 1. Why `React.lazy()` needs a fallback, and why one boundary was enough

`React.lazy()` wraps a dynamic `import()` — the first time a lazy
component is about to render, React "suspends" that render and walks up
the tree looking for the nearest `<Suspense>` ancestor to show instead,
while the browser fetches that page's chunk in the background. Skip the
`<Suspense>` boundary and React throws instead of rendering anything.

`AppRoutes.tsx` puts `RequireAuth` and `RequireTeacher` in as **layout
routes** — `<Route element={<RequireAuth />}>` wrapping child `<Route>`s,
with `RequireAuth` itself rendering `<Outlet />` for whichever child
matched. That structure is what let one `<Suspense>` around the entire
`<Routes>` block cover all twelve routes at once: React doesn't care how
many components sit between a suspending one and its boundary — a lazy
`Dashboard` rendered three components deep, through `Outlet`, still finds
the same top-level `<Suspense>`. No per-route wrapping needed.

One consequence worth knowing: the auth check in `RequireAuth` and the
chunk fetch for the page underneath it are two separate async things,
resolved one after the other, not at once. A student who's already
authenticated but navigating to a page chunk they haven't fetched yet sees
`PageLoading` for the chunk fetch alone — `RequireAuth`'s own `loading`
state (session restore from `localStorage`) only shows up on a fresh page
load or refresh, before the auth check has resolved at all.

## 2. One fallback component, two call sites

The gap-filler UI already existed — `RequireAuth.tsx` had `AuthPending`
("Finding your sprig", pulsing forest dot, uppercase mono tracking) for
its own `loading` state, and `RequireTeacher.tsx` already reused it. Rather
than invent a second, differently-styled loading screen for lazy chunks,
that visual was pulled out into `src/components/PageLoading.tsx` — a
`label` prop, `"Loading"` by default — and `AuthPending` became a one-line
wrapper around it (`<PageLoading label="Finding your sprig" />`). Same
component now backs both the auth-pending state and the `Suspense`
fallback, so a loading moment always looks the same regardless of which
async thing the app is waiting on.

## 3. What the build actually looked like, before and after

Before: one `index-*.js` around 570 kB, everything in it.

After (`npm run build`, no warning):

```
dist/assets/index-DigjsMQI.js         447.45 kB │ gzip: 130.21 kB   <- shared app shell + libraries
dist/assets/Lesson-DSNJ7Bqg.js        275.04 kB │ gzip:  82.37 kB   <- KaTeX ships only here
dist/assets/Dashboard-Bkv3Zcsi.js      28.52 kB │ gzip:   7.99 kB
dist/assets/Landing-CSzhAYyX.js        14.98 kB │ gzip:   4.26 kB
dist/assets/Progress-DFsJbYdd.js       14.13 kB │ gzip:   4.37 kB
dist/assets/TopNav-bJk-zEBy.js         13.03 kB │ gzip:   4.28 kB
dist/assets/TestFlow-ByeuJ3-f.js       12.45 kB │ gzip:   3.98 kB
... (rest of the twelve pages, 5-12 kB each)
```

The shared shell dropped under the 500 kB line on its own, without moving
a single byte elsewhere — nothing was deleted, the same code just now sits
in chunks that load on demand. `Lesson.tsx` stayed the single largest
chunk by a wide margin, because that's the only page that pulls in KaTeX
(added 13 August for maths rendering) — worth knowing if bundle size comes
up again, since that's where the next win would be, not in further
route-splitting.

## What was verified

Built the production bundle (`npm run build`) and confirmed the bundle-size
warning was gone. Then served that exact build with `vite preview`
(not `vite dev` — this checks the real chunked output, not a dev-server
approximation) and drove it in a real browser, logged in both as a
student and as a teacher, through every one of the twelve routes:

| Route | Verified |
|---|---|
| `/` (Landing) | ✅ renders |
| `/login` | ✅ renders, both student and teacher forms |
| `/help` | ✅ renders |
| `/set-pin` | ✅ reached via forced-PIN-change redirect, saves and continues |
| `/dashboard` | ✅ renders, journey tree with real progress data |
| `/topic/:topicId` | ✅ renders, subtopic list |
| `/lesson` | ✅ renders, slide content |
| `/library` | ✅ renders, tier tabs and lesson list |
| `/progress` | ✅ renders, growth chart section |
| `/test` | ✅ renders, Growth Check start screen |
| `/certificate` | ✅ renders (mock data, as already documented) |
| `/teacher` | ✅ renders, roster and class progress chart |

Console was checked for errors after every navigation across the whole
session — none. The `Suspense` fallback itself was also caught mid-render
on a fresh full-page load to `/help`, confirming it actually shows (rather
than the chunk just happening to load too fast to notice) and that it
matches the design system rather than a generic spinner.

The student and teacher accounts used for this were scratch accounts
(`codesplit-scratch@sprig.study`, nickname "Wandering Finch") created via
`scripts/create-teacher.ts` and `scripts/create-students.ts` specifically
for this check, and both were deleted afterward via the Supabase admin API
— nothing pilot-facing was left behind.

**Not done this session:** trimming the `Lesson.tsx` chunk itself (KaTeX is
the main contributor at 275 kB) — flagged above as the next lever if bundle
size needs to come down further, not attempted here since the ask was
specifically route splitting.
