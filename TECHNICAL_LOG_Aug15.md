# Technical log — 15 August 2026

## What this session was

A full manual QA pass over the whole app: auth, database, every page, every
button, as both a student and a teacher. No code was changed. The output is a
list of findings, plus one thing that turned out to matter more than any of the
UI bugs — a foreign key that quietly makes students undeletable.

Four scratch accounts were created for the pass and deleted afterwards. The
eight pre-existing students from July and the two pre-existing teachers were
not touched.

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

### The fix, when you come to it

Split text segments on `\n\n` (paragraph break) and `\n` (line break) inside
`renderTextBody`, emitting separate `<p>`s and `<br>`s. Alternatively, put
`white-space: pre-wrap` on the container — a one-line change, but it also makes
the source's own soft wrapping significant, so the explicit split is safer.

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

The fix is to clamp the radius yourself: `ry={Math.min(38, h / 2)}`, or draw a
path with only the top two corners rounded.

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

## Migrations no longer describe the live database

Signed in as a student, `select` on `topics` returns rows. It should not.

`topics`, `subtopics`, `slides` and `questions` all have `alter table … enable
row level security` and are **never given a SELECT policy** in any migration.
Under RLS the default is deny: enabling RLS without policies means nobody reads
anything. A `grant select` does not help — grants and policies are two separate
gates and you must pass both.

Since the app demonstrably reads curriculum, RLS must have been switched off on
those four tables directly in the Supabase dashboard at some point. That change
exists only in the live database, not in the migration history.

The practical risk: rebuilding this database from `supabase/migrations/` — new
environment, disaster recovery, a second school — produces an app that loads,
authenticates, and shows an empty curriculum, with no error anywhere. Worth
reconciling into a real migration before the pilot.

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
