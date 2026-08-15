# Technical log — 15 August 2026

## What this session was

Two halves. First a full manual QA pass over the whole app — auth, database,
every page, every button, as both a student and a teacher — which produced a
ranked list of findings, including one thing that mattered more than any of the
UI bugs: a foreign key that quietly made students undeletable. Then the top six
of those findings were fixed, verified and shipped.

The sections below are in the order the work happened: what each bug was and why
it existed, then **The fixes, and how each was proven**, then what the QA pass
found already working. One finding is **retracted** — it was wrong, and the way
it went wrong is written up rather than deleted.

Read in one sitting, the through-line is not really "six bugs". It is that a
plausible explanation is not evidence. A latent bug that new content finally
exercised looked exactly like a regression; a missing policy that a search
failed to find looked exactly like a policy that did not exist; an obvious
one-line clamp for the bar chart was in fact the very thing causing the bug. In
each case the cost of checking was minutes and the cost of assuming would have
been a wrong fix shipped with confidence.

Five scratch accounts were created across the session and all were deleted
afterwards. The eight pre-existing students from July and the two pre-existing
teachers were not touched.

---

## The headline bug: HTML eats your newlines

### What you see

Open Tier IV, Topic II ("The Real Compound Interest Formula"), subtopic 3,
slide 2. The source content is a five-step worked example, one step per line:

```
1. $\frac{r}{n} = \frac{0.04}{4} = 0.01$
2. $1 + 0.01 = 1.01$
3. $nt = 4 \times 3 = 12$
...
```

What renders is a single unbroken line: `1. r/n = 0.04/4 = 0.01 2. 1 + 0.01 =
1.01 3. nt = 4 × 3 = 12 …`. Unreadable as a worked example.

### Why it happens

This is one of the oldest gotchas in web development, and it is worth
understanding properly because it will bite you again.

**In HTML, a newline is just whitespace.** The browser collapses any run of
spaces, tabs and newlines into a single space when it lays out text. This is
deliberate — it lets you indent your HTML source without the indentation
showing up on the page. The consequence is that a `\n` in a string you drop
into a `<p>` does nothing at all.

There are three normal ways to get a line break:

1. A `<br>` element.
2. Separate block elements — `<p>`one</p><p>two</p>`.
3. CSS `white-space: pre` / `pre-wrap`, which tells the browser to stop
   collapsing whitespace. This is exactly what the code slides use, which is
   why *they* preserve their indentation and text slides do not.

Now look at `renderTextBody` in `src/pages/Lesson.tsx:439-452`:

```js
parseMathSegments(body).forEach((segment, i) => {
  if (segment.type === "text") {
    paragraph.push(<Fragment key={i}>{segment.value}</Fragment>);   // newlines survive in the STRING…
  } else if (segment.type === "inline") {
    paragraph.push(<InlineMath key={i} math={segment.value} />);
  } else {
    flushParagraph(`p-${i}`);                                        // …only $$block$$ math starts a new <p>
    nodes.push(<div key={`b-${i}`}>…</div>);
  }
});
```

`flushParagraph` — the only thing that ever closes a `<p>` and opens a new one
— is called in exactly one branch: block math. Every text segment, newlines and
all, gets pushed into the same paragraph array and rendered inside a single
`<p>`. The newlines are still in the string; the browser just refuses to draw
them.

### The thing worth internalising

**This is not a regression.** Before the KaTeX commit the code was
`<p>{body}</p>`, which collapsed newlines in exactly the same way. Nothing
broke on 13 August.

What changed is the *content*. Tiers I and II were authored as single blocks of
prose with no internal line breaks, so the bug was invisible. Tier III started
using line breaks, and Tier IV — written as numbered steps, variable
definitions and worked examples — relies on them almost everywhere. Measured
across the seed migrations: **82 of 87 Tier IV text slides lose at least one
line break.**

A latent bug plus new content that exercises it looks exactly like a new bug.
When something "breaks" right after you add content, check whether the code
ever handled that shape — often the answer is that it never did, and you simply
never asked it to.

### The fix

Split text segments on `\n\n` (paragraph break) and `\n` (line break) inside
`renderTextBody`, emitting separate `<p>`s and `<br>`s. The alternative was
`white-space: pre-wrap` on the container — a one-line change, but it also makes
the source's own soft wrapping significant, so the explicit split won.

Done, in `eac1c96` — see [The fixes, and how each was proven](#the-fixes-and-how-each-was-proven)
for what shipped, the CRLF near-miss it turned up, and the DOM measurements that
back it.

---

## The bug the cleanup found: a missing `on delete cascade`

This is the most important finding of the session and it was found by accident,
while tidying up.

### What happened

Deleting the four scratch accounts should have been trivial. Three of them
vanished cleanly. The fourth — Eager Finch, the only one that had actually
*used* the app — failed with:

```
AuthRetryableFetchError  status: 500  message: {}
```

An empty error message and a 500. Retrying gave the same result, so it was not
transient.

### Why

Look at `supabase/migrations/20260721000000_init_schema.sql:48-54`:

```sql
create table if not exists progress (
  student_id uuid not null references students(id),   -- <- no ON DELETE action
  subtopic_id uuid not null references subtopics(id),
  ...
);
```

`references students(id)` with no `on delete` clause defaults to **`ON DELETE
NO ACTION`** — meaning "refuse to delete the parent row while any child row
still points at it." The same omission appears on `test_attempts`,
`daily_checkins` and `weekly_checkins`.

So the delete chain is broken in the middle:

```
auth.users  --ON DELETE CASCADE-->  students  --NO ACTION-->  progress
   ✓ this half was set up correctly        ✗ this half blocks the whole thing
```

`students.id references auth.users(id) on delete cascade` was written
correctly. But when Postgres tries to cascade the delete down into `students`,
it hits the `progress` row that still references it, raises a foreign key
violation, and the whole transaction rolls back. GoTrue catches that as an
unhandled database error and returns a bare 500.

Confirmed by fixing it by hand: delete the `progress` and `test_attempts` rows
first, and the same `deleteUser` call succeeds immediately.

### Why this matters more than it looks

It is not a QA-script inconvenience. It means:

- **Any student who has completed a single lesson can never be deleted** through
  the normal admin path. Only students who have done literally nothing can.
- A school asking for a pupil's data to be removed cannot be served. For a
  platform aimed at 13–14 year olds in UK schools, that is a data-protection
  problem, not a nice-to-have.
- The failure is **silent and undiagnosable** — a 500 with an empty message
  gives no hint that a foreign key is the cause.

### The concept

`ON DELETE` behaviour is not a detail you add later. The four options you will
actually use:

- `CASCADE` — delete the children too. Right for data that has no meaning
  without its parent: a student's progress, their test attempts, their
  check-ins.
- `SET NULL` — keep the child, blank the link. Right for
  `students.teacher_id`, which the codebase already gets correct: deleting a
  teacher should not delete their pupils, it should orphan them.
- `RESTRICT` / `NO ACTION` (the default) — refuse. Right when deletion should
  genuinely be blocked, but then you want to catch the error and explain it.

The rule of thumb: **write the `on delete` clause every time you write a
`references`, even when the default is what you want**, so the next reader can
tell you decided rather than forgot. This codebase got it right in the two
places where it was thought about (`auth.users`, `teacher_id`) and defaulted
everywhere else.

The fix is a migration altering the four constraints to `on delete cascade`.
Shipped as `20260815000000_cascade_student_deletes.sql` in `faa8f1d`, and proven
by actually deleting a student who had rows in two of those tables.

---

## Two smaller rendering bugs

### Bars that are secretly ellipses

`src/components/sprig/TopicBars.tsx:73-74` draws each bar as:

```jsx
<rect width={76} height={Math.max(h, 2)} rx={38} ry={38} />
```

`rx`/`ry` are corner radii. `rx = 38` is half the bar's width, which gives the
intended pill shape. But **SVG clamps a corner radius to half the relevant
side** — you cannot round a corner by more than the shape can accommodate. So
when the bar is shorter than 76px, `ry` gets silently clamped to `height / 2`,
and a rectangle whose corner radii are half its width *and* half its height is,
geometrically, an ellipse.

`innerH` is 256px, so the threshold is `76 / 256 ≈ 30%`. **Any topic below ~30%
completion renders as an oval blob rather than a bar** — which is most topics,
for most students, most of the time. It hits the teacher's class chart too,
since both pages share the component.

The obvious fix — "clamp the radius yourself", `ry={Math.min(38, h / 2)}` — was
written down here first and is **wrong**. It is a no-op: clamping `ry` to
`h / 2` is exactly what SVG already does, and doing it explicitly reproduces the
bug rather than fixing it. Left in as a reminder that a fix which merely restates
the behaviour you are trying to change will apply cleanly, pass review, and
change nothing. What actually shipped was the path — see
[The fixes](#the-fixes-and-how-each-was-proven).

### A baseline labelled as a Growth Check

`src/pages/Progress.tsx:160`:

```js
source: entry?.testType === "progress_check" ? "progress" : "growth",
```

A binary where there are three test types. `baseline` is not `progress_check`,
so it falls into `growth`, and a student's very first missed questions are
labelled "Missed on a Growth Check" — a test they have not taken. Cosmetic, but
the kind of thing that quietly erodes trust in the numbers.

---

## RETRACTED: "migrations no longer describe the live database"

**This section originally claimed that `topics`, `subtopics`, `slides` and
`questions` had no SELECT policy in any migration, and that RLS must therefore
have been disabled by hand in the Supabase dashboard. That was wrong. It is
corrected here rather than deleted, because the way it went wrong is the useful
part.**

### What is actually true

The four policies exist, in tracked migration history, at
`20260724010000_seed_topic_I_I_content.sql:67-70`:

```sql
create policy "Public read access" on topics    for select using (true);
create policy "Public read access" on subtopics for select using (true);
create policy "Public read access" on slides    for select using (true);
create policy "Public read access" on questions for select using (true);
```

Every table is fully covered — RLS enabled, policy created, grant applied:

| table | RLS enabled | SELECT policy | GRANT |
|---|---|---|---|
| `topics` | `20260721000000_init_schema.sql:89` | seed:67 | `20260724020000` |
| `subtopics` | `20260721000000_init_schema.sql:90` | seed:68 | `20260724020000` |
| `questions` | `20260721000000_init_schema.sql:91` | seed:70 | `20260724020000` |
| `slides` | `20260724000000_add_slides…:21` | seed:69 | `20260724020000` |

No migration contains `drop policy` for any of them, and none contains
`disable row level security` at all. A rebuild from `supabase/migrations/`
produces a working app with a readable curriculum. **There is no drift and
nothing to reconcile.**

Confirmed empirically as well: the anon key reads 20 topics, 80 subtopics, 334
slides and 336 questions — identical counts to the service-role key, which
bypasses RLS — while `students` and `progress` correctly deny anon. That is
exactly what `using (true)` plus the grant predicts.

### Why the wrong conclusion was reached

Two failures compounded, and both are worth avoiding again.

**The search looked in the wrong shape of file.** An automated sweep for policy
definitions checked the migrations whose names describe security work
(`…_student_rls_policies.sql`, `…_teacher_tools.sql`) and reported that no
SELECT policy existed for the curriculum tables. The policies were there all
along — sitting at the bottom of a seventy-line *content seed* file, below a
wall of question inserts. A search for "where are the policies" that assumes
policies live in policy-shaped files will miss policies that do not.

**A negative result was treated as a finding.** "I did not find X" was written
up as "X does not exist." Those are different claims, and the gap between them
is exactly the width of the search's blind spot. A negative is only as strong
as the search that produced it, and the way to promote one is to look for the
thing from the opposite direction — here, checking whether observed behaviour
was *consistent* with the claim. It was not: the app plainly read curriculum
data, which under default-deny should have been impossible. That contradiction
was visible at the time and got explained away ("someone must have disabled RLS
in the dashboard") instead of being treated as evidence the premise was wrong.

**The rule: when a conclusion requires inventing an unobserved event to hold
together, suspect the conclusion, not the world.** The invented event here was a
dashboard change nobody remembered making, and it existed only to rescue a claim
that a slightly wider `grep` would have refuted.

### The one real (and minor) observation that survives

The four policies live in a *content seed* migration rather than a security one.
Every other policy in this project follows the house convention documented at
`20260725010000_student_rls_policies.sql:26` — a dedicated migration, with
`drop policy if exists` before each `create policy` so the file is re-runnable.
The seed file does neither.

Nothing is wrong today. The latent risk is that someone standing up a fresh
environment might reasonably skip or prune the Tier I *content* seed and
silently lose curriculum RLS along with it. Relocating the four declarations
into a properly named, idempotent migration would remove that coupling. It
would be a no-op against the live database, so it was judged not worth a
migration for now — recorded here so the reasoning is not lost.

---

## The fixes, and how each was proven

All six shipped the same day, in two commits: `eac1c96` (five code fixes) and
`faa8f1d` (the migration). They were split because the migration could not be
applied from here — this project has no `config.toml` and no CLI link, so
migrations are pasted into the Supabase SQL Editor by hand — and committing an
unapplied migration would have meant committing something unproven.

### 1. Line breaks (`src/pages/Lesson.tsx`)

A blank line now starts a new `<p>`, a single newline becomes a `<br>`, and
inline math still flows inside its sentence. Block `$$math$$` still flushes to
its own centred div, as before.

**A near-miss worth recording.** The first version split on `/\n{2,}/`. The seed
`.sql` files on disk are CRLF, and `\r\n\r\n` does not match `\n{2,}` — the two
`\n` are not adjacent, there is a `\r` between them. Had the stored bodies
carried CRLF, the paragraph split would have done nothing at all and the fix
would have appeared to work while silently failing.

The right move was to check rather than assume, because the answer was not
guessable: the `.sql` files are only a historical record, and Tier IV was
inserted through supabase-js. Querying the actual table showed all 334 slides
are LF-only, 154 of them with real `\n\n` breaks. The fix was already correct.
Line endings are normalised anyway now — one `replace` makes a whole class of
failure impossible rather than merely unlikely, and the documented workflow
(pasting CRLF files into the SQL Editor) could reintroduce it at any time.

**Proven** by DOM structure, not by eye: IV.II "Step by step" renders 2
paragraphs / 4 `<br>` / 5 inline KaTeX — a five-line numbered list plus a
separate conclusion, where before it was one run-on line. IV.I "Save it and run
it" renders 4 paragraphs. A Tier I slide with no newlines still renders exactly
1 paragraph and 0 `<br>`, which is the regression check that matters most.

**A limit worth knowing.** No Tier IV slide contains an indented line, so nested
lists never arise. If one is ever authored, `<br>` alone will not save it —
HTML collapses leading whitespace however the line break is produced. That would
need `white-space: pre-wrap` or real `<ul>` markup.

### 2. The cascade (`supabase/migrations/20260815000000_…`)

All four child tables now declare `on delete cascade`. `students.teacher_id`
deliberately stays `on delete set null`: deleting a teacher must orphan their
pupils, not delete them. Two foreign keys, two different right answers — which
is the whole lesson of this bug.

The constraints are located by what they point at rather than by assumed name.
Hardcoding `<table>_student_id_fkey` and failing to match would have been worse
than useless: `drop constraint if exists` would silently no-op, the `add` would
put a *second* foreign key on the column, and the original NO ACTION rule would
still be sitting there blocking deletes — a fix that reports success and changes
nothing.

**Proven behaviourally.** Reading `confdeltype` out of the catalog would only
confirm the letter `c`; it cannot tell you a delete actually completes. So a
scratch student was given 4 progress rows and 1 test attempt — precisely the
state that used to fail — and deleted. One `deleteUser` call, OK in 377ms, zero
rows left in all four child tables.

**Not re-verified:** that `students.teacher_id` is still `set null`. The
migration's DO block only selects constraints whose `confrelid` is `students`
and whose column is `student_id`, and `teacher_id` is neither, so it is outside
what the loop can touch. The verification query at the foot of the migration
answers it directly if you want certainty.

### 3. Bars that were secretly ellipses (`TopicBars.tsx`)

The obvious fix does not work, and that is the interesting part. Clamping by
hand — `ry={Math.min(barW/2, h/2)}` — is *precisely what the renderer already
does*, because SVG clamps a corner radius to half its side automatically. That
clamp is not the bug's neighbour; it is the bug.

An ellipse appears exactly when `rx === width/2` **and** `ry === height/2`
together. Keeping the full-width cap while refusing to fully round the foot
therefore means leaving the rounded-rectangle shape family entirely, so the bar
is now a path: rounded top, flat foot on the baseline. It also sits better
against the axis than the old floating capsule did.

**Proven** by walking percentages 0/1/5/10/25/29/30/50/75/100 and computing both
geometries: the old code produces 6 ellipses across those ten values, the new
one produces none, and the crossover lands at 29%→30% exactly as `76/256`
predicts. Then confirmed in the browser with a 25% bar rendered beside a 75% one.

### 4. Three cases do not fit a boolean (`Progress.tsx`, `growth-check-parked.tsx`)

`testType === "progress_check" ? "progress" : "growth"` silently filed every
baseline under "growth". Card styling now lives in one record keyed by test
type, so the badge and the legend cannot drift apart and a fourth type would be
a one-line change. **Proven:** a seeded baseline produces four missed cards, all
badged "Baseline", with all three sources listed in the legend.

### 5. Inline math may now cross one line (`parseMath.ts`)

Hardening, not a live bug — no current content trips it. One continuation line
is allowed and no more, so a stray unpaired `$` can swallow at most two lines
instead of running to the next `$` however far away, and a blank line ends it
outright. **Proven** against the real module: the same 122 dollar characters
still resolve to the same 55 expressions, a wrapped formula now matches, and
four guardrail cases hold.

### 6. The Help box now actually sends (`Help.tsx`)

It answered a submitted message with "Sent — thank you" and promised a reply
within two days, while discarding the text. The brief was to soften the wording;
the wording was not really the problem. Send now opens the reader's mail client
with what they typed, addressed to the contact already on the landing page, so
the page's claim is simply true. **Proven** by asserting the encoding survives
`&`, `?`, newlines and em-dashes — any of which would otherwise corrupt the
message — without clicking Send and launching a mail app.

---

## What was verified working

Worth recording, because the security model came through the pass intact.

**Row Level Security.** Probed directly through the app's own Supabase client
rather than the UI, which is the only way to be sure. A student reads zero rows
from `progress`, `test_attempts`, `teachers` and `weekly_checkins`, and exactly
one row from `students` — their own. They cannot even enumerate their
classmates' nicknames. A teacher reads their own three students and their
progress, and **zero** rows from `test_attempts`, `daily_checkins` and
`weekly_checkins` — no score, no mood, exactly as designed.
`login_attempts` returns a hard `permission denied` to both.

**The teacher tools, verified by actually signing in.** `teacher_reset_pin`
writes a bcrypt hash straight into `auth.users` and its failure mode is silent,
so a clean return proves nothing. The full chain was checked end to end: five
wrong PINs locked the account, the lock rejected even the *correct* PIN, the
teacher's Unlock cleared it, Reset PIN produced `REDACTED-PIN`, and that PIN then
actually authenticated and landed on the forced `/set-pin` screen. Both actions
were written to `teacher_actions` with `outcome: succeeded`.

**Everything else.** Forced first-login PIN change and all three weak-PIN rules;
the lockout counter, including correct singular/plural ("1 try" vs "4 tries");
all four question types; the progress write and the subtopic unlock chain; leaf
avatars persisting across a full reload; the `MIN_TEST_QUESTIONS` guard;
baseline scoring (27.8% = 5/18, with "not sure" correctly in the denominator);
the growth chart; every route guard and the 404 catch-all. Console clean on
every page. `npm run build`, `npm run lint` and `npm run check:questions` all
clean, with the 336-question count and the three known Tier II content findings
unchanged.

**Two things predicted to be broken that were not.** Worth noting because being
wrong in this direction is the good direction:

- Code slides were expected to overflow horizontally on narrow screens.
  They do not — the `<pre>` carries `overflow-x: auto`, and a simulated 350px
  container scrolls the block internally without the page scrolling sideways.
- The math regex was expected to leave stray literal `$` on some slide. It does
  not. All 122 `$` characters across 19 slide bodies are consumed correctly —
  checked by running the actual `MATH_PATTERN` from `src/lib/parseMath.ts` over
  every seed migration rather than by clicking through slides.

That last technique is worth keeping. When you want to know whether a parser
handles all your content, run the real parser over all the content. It is
faster than clicking and it actually proves something.

---

## Known-incomplete, not broken

Verified present and non-crashing, listed separately so they do not get
confused with regressions: Certificate's Download PDF and Print buttons have no
handlers and the page renders a full completion certificate naming "Amelia
Kestrel" for a student with zero progress; every Library row links to a bare
`/lesson` and lands on one hardcoded topic, and the Library shows "4/5
unlocked" to a student who has unlocked nothing; the Help contact box promises
"a real person reads every one" and "we reply within 2 days" behind a Send
button that stores nothing; the topic video button is inert; TopNav
notifications are three hardcoded fakes; `daily_checkins` has no writer.

The Help one is worth prioritising — the others look unfinished, but that one
makes a promise the app cannot keep to a child who may be asking for help.
