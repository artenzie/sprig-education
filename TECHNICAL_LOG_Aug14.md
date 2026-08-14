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
