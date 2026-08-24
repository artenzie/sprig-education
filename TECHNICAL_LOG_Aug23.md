# Technical log — 23 August 2026

## What was built

One feature and two rounds of copy, in four commits:

| commit | what |
|---|---|
| `be09e43` | `contact_requests` — leave-your-email for adults, with its host inbox |
| `4cf04b7` | stop showing raw Postgres errors to the person who hit them |
| `f460a80` | rewrite About me; soften the "built with teachers" claim |
| `36da2ed` | soften the last present-tense partnership claim |

The feature is small: a form on `/login` that takes an email address and an
optional note, a table, and a section on the host dashboard that lists them.
Most of this log is about the parts that were **not** obvious — a bug in how an
argument gets sent, a bug in which errors are safe to show, and one decision
about honesty in copy that is really a correctness decision wearing different
clothes.

---

## 1. Two tables that look identical and are opposites

There was already `help_messages`, with exactly the security shape this feature
needed: RLS on, no policies, no grants, writes through a security-definer RPC.
The obvious move is to reuse it and add an `email` column.

That would have been wrong, and the reason is worth being precise about,
because "same shape" is a weak argument for "same table":

| | `help_messages` | `contact_requests` |
|---|---|---|
| who writes | a student, usually signed in | an adult with no account |
| identity stored | `student_id` from `auth.uid()` | the email address itself |
| reply path | **none** — "this box doesn't know who you are" | **the entire point** |
| the payload | the message | the address; the note is optional |

Merge them and you get a nullable `email` that is meaningless on most rows and a
nullable `student_id` that is meaningless on all of them. Two audiences, two
purposes, two tables.

**The concept.** Tables are defined by what a row *means*, not by which columns
they happen to share or which access pattern they use. Two things with identical
security requirements can still be different things.

Note what this does NOT mean: the security *pattern* was copied wholesale, and
should have been. Reuse the mechanism, not the container.

---

## 2. Rate limiting when there is no identity to key on

`submit_help_message()` has two guards: five per hour per student, sixty per
hour globally. The per-student one is the good one — it is keyed on
`auth.uid()`, which the client cannot forge because the client never supplies
it.

`submit_contact_request()` cannot do that. Whoever fills this form in has no
account; that is the reason they are filling it in. So there is no `auth.uid()`,
and the only thing available to key a limit on is **the email address they just
typed** — which they can change at will.

```sql
-- Guard 1: three per hour per address.
if (select count(*) from public.contact_requests
     where email = v_email
       and created_at > now() - interval '1 hour') >= 3 then
  raise exception 'We already have that address — Artem will be in touch.';
end if;
```

The migration says out loud that this is trivially sidestepped by typing a
different address, and that this is fine, **because it is not the guard doing
the security work**. It exists to make accidents cheap: an impatient
double-click, a genuine follow-up thought, a page refresh. Those are the common
case by an enormous margin.

The global cap is the one facing an adversary, and it carries the same honest
note its neighbour does:

```sql
-- 30/hour globally. A cost circuit-breaker, NOT a spam filter.
```

The trade is real and stated in the file: someone determined can trip it and
take the form away from genuine teachers until the hour rolls forward. Thirty is
half the help box's sixty, because the traffic is different in kind — a handful
of adults across a pilot, against ninety students who might all hit the same
confusing lesson in one period.

**The concept, and it is the useful one:** a limit that can be bypassed is not
worthless, but you have to know *which* threat each one addresses. Writing
"stops spam" over the per-email guard would have been a lie that someone later
relies on. Writing "makes accidents cheap" is true and sets the right
expectation for whoever reads it next.

---

## 3. The bug: `undefined` does not mean "use the default"

This one is short and will bite again.

The function is declared with a default:

```sql
create or replace function public.submit_contact_request(
  p_email   text,
  p_message text default null
)
```

and the client, reasonably, sent nothing when the note was empty:

```ts
p_message: trimmedMessage.length > 0 ? trimmedMessage : undefined,   // WRONG
```

The failure looked like this:

```
Could not find the function public.submit_contact_request(p_email)
in the schema cache
```

Read the signature in that error: **one argument.** Two things combined to
produce it:

1. `JSON.stringify` drops keys whose value is `undefined`, so supabase-js sent
   `{"p_email": "..."}` with no `p_message` key at all.
2. **PostgREST resolves an RPC by the exact set of argument NAMES in the body.**
   Given only `p_email`, it went looking for a one-argument overload — a
   different function, which does not exist.

The fix is one word:

```ts
p_message: trimmedMessage.length > 0 ? trimmedMessage : null,        // RIGHT
```

`null` is a value. It appears in the JSON, both parameter names are present, the
two-argument function resolves. The SQL already normalises `''` and `null` to
the same thing (`nullif(btrim(coalesce(p_message, '')), '')`), so the column
still ends up genuinely empty rather than holding a blank string.

**The concept.** In JavaScript `undefined` and `null` are casually
interchangeable and mean roughly "nothing". Across a serialisation boundary they
are not interchangeable at all: one is *absence of the key* and the other is *a
key whose value is null*. Any protocol that dispatches on which keys are present
— and PostgREST is one — will treat those as different requests.

---

## 4. Which errors are safe to show a person

Both `help.ts` and `contact.ts` had to answer: this RPC failed, do we show the
user the message or a generic one?

The original answer, in `help.ts` since August, was a guess:

```ts
error.message && !error.message.toLowerCase().includes("fetch")
  ? error.message                                  // assume it's ours
  : "That didn't send. Check your connection…"     // assume it's the network
```

The theory: network failures say "Failed to fetch", so anything else must be one
of our own written-for-humans messages. **Most internal failures say neither.**
The missing-function error above sails through that test, and lands in red on
the page of a teacher — or a thirteen-year-old who already cannot log in, which
is very plausibly why they are writing to the help box in the first place.

The right discriminator is the error **code**, and rather than assume, I checked
it against the live API:

```
submit_help_message('   ')      -> P0001    "Please write a message before sending."
submit_help_message('x'*2500)   -> P0001    "That message is a bit too long — …"
no_such_function_at_all()       -> PGRST202 "Could not find the function … in the schema cache"
```

`P0001` is PostgreSQL's `raise_exception`. That is exactly the line this schema
draws: **every refusal meant for a person to read is written as a sentence and
raised.** So the code separates "we wrote this for you" from "this is plumbing",
with no guessing:

```ts
if (error.code === "P0001" && error.message) {
  return { ok: false, message: error.message };
}
console.error("Unexpected error leaving a contact request", error);
return { ok: false, message: "That didn't send. Please try again in a moment — …" };
```

Two smaller decisions inside that:

- **The swallowed error is logged, not dropped.** Lifted from `readableError()`
  in `teacherAuth.ts`. Hiding an error from the reader should never mean losing
  it from the console.
- **Left as two copies rather than a shared helper.** `HostSection.tsx` states
  the project's rule out loud — *"Three copies is the point at which it becomes
  a component rather than a pattern"* — and this is two. Following a convention
  the codebase already wrote down beats inventing a better one privately.

**The concept.** When you branch on an error, branch on the part of it that is
*specified*. A code is a contract. A substring of a human-readable message is a
guess about wording that nobody promised you.

---

## 5. Shipping the reader with the writer

`contact_requests` went in with `host_contact_requests()` and a host dashboard
section, in the same commit. That was deliberate, and it is a lesson taken
directly from the migration next door.

`20260817000000_help_messages.sql` records the Help box's history in its own
opening lines: it began by answering a send with "Sent — thank you" and a
promise of a reply within two days **while doing nothing with the text at all**.
Then the table shipped with "There is no inbox UI yet" written in the file, and
sat unread until the host dashboard existed three weeks later.

A form that says *"Artem will get in touch"* over a table nobody reads is the
same failure with better wording. So the section shipped with the table.

The success copy is careful for the same reason. It says the address is saved
(true, and checkable) and that a reply comes by email (the only channel that
exists). It deliberately does **not** promise a timeframe, because that is
precisely the sentence the first version of the Help box got wrong.

**The concept.** A feature is not the write path. If the product makes a promise
to a person, the thing that keeps the promise is part of the feature, and
shipping without it means shipping a lie with a deadline on it.

---

## 6. Testing the failure path first — which is how both bugs were found

The migration could not be applied from here: no Supabase CLI, and `.env` holds
only the REST URL and keys, no Postgres connection string. So there was a window
where the client existed and the function did not.

Rather than wait, I submitted the form. That is how §3 and §4 were both found —
neither would have appeared on the happy path, because on the happy path there
is no error to mis-handle and PostgREST never has to resolve a signature it
cannot find.

Once the migration was applied, verification went the other way — every branch,
not just the one a well-behaved user takes:

```
PASS  email only accepted                  (message stored as genuine NULL)
PASS  email + note accepted                (note verbatim)
PASS  MiXeD@… stored as mixed@…            (lowercased)
PASS  bad email "nope"        -> P0001     "That does not look like an email address."
PASS  401-char note           -> P0001     "That note is a bit long — …"
PASS  per-email: 3 accepted, 4th refused   "We already have that address — …"
PASS  anon direct table READ  -> 42501
PASS  anon direct table INSERT-> 42501
PASS  anon host_contact_requests -> 42501
```

The rate limit was tested **at the boundary in both directions**, which is the
only test of a threshold worth running:

```
29 rows in the hour  ->  the next one is ACCEPTED
30 rows in the hour  ->  the next one is REFUSED
```

One check either side. A test that only proves "it refuses eventually" would
pass just as happily against a cap of 5 or 500.

**The concept.** An off-by-one in a limit is invisible from one side. Assert the
last allowed case as well as the first refused one, or you have measured that a
wall exists without measuring where.

Two things it was honest to report as *not* verified: `scripts/check-rls.ts`
needs `RLS_CHECK_*` credentials that are not in `.env`, and I had no host
password, so I never saw the dashboard section render real rows. The security
properties were proven directly — anon refused, a signed-in student refused,
`host_contact_requests()` returning zero rows to a non-host — but "it compiles
and mirrors the component next door" is not "I saw it work", and saying so is
cheaper than being wrong later.

---

## 7. Copy that borrows credibility

The trust panel on the Landing page had three items under the heading *A quiet
promise*:

- Fully anonymous — *students never give real names*
- Built with teachers — *every lesson is shaped alongside UK educators who work with this age group*
- No data sold — *nothing about a student is ever sold, shared, or handed to advertisers*

Two of those are checkable facts about the system. The middle one describes a
co-design process that has not happened yet.

That is worse than a merely inaccurate sentence, because of the company it
keeps: **placed between two verifiable promises, an aspirational one inherits
their credibility.** And the failure mode is badly timed — the first teacher to
ask "which educators?" finds out at the exact moment trust matters most.

It now reads *"Shaped with schools / In active development, with schools and
teachers invited to help shape the content as the pilot grows"*, which is true
today and is also the thing that might make the original true later.

A sweep for the same claim in other wording — *educators, shaped, input from,
designed with, developed with, alongside, curriculum, trusted, used by, proven,
expert* — found it in exactly one other place, the Help FAQ, which carried it
inside the answer to "Who made Sprig?". Every remaining mention of teachers in
user-facing copy turned out to be operational ("the nickname and PIN your
teacher gave you"), which is a description of how the product works rather than
a claim about how it was made.

One further line survived the first pass and was caught on reading the section
back: *"I work directly with schools, teachers, and organisations"* — present
tense, four paragraphs above a panel now saying schools are invited. Now *"I'm
reaching out to"*.

**The concept.** Marketing copy is a correctness surface. A claim in a trust
panel is an assertion about the system exactly like a return type is, and it can
be wrong in the same way — the difference is that nothing typechecks it, so the
only available tool is a deliberate search for every place the claim appears.

---

## 8. Where things stand

- The migration is `supabase/migrations/20260820000000_contact_requests.sql`,
  applied. `contact_requests` is empty; every test row was deleted after use.
- `check-rls.ts` gained two invariants — the table must be neither readable nor
  insertable directly by any browser role. They run on the next execution with
  `RLS_CHECK_*` credentials present.
- `main` was at `36da2ed` and pushed at this point in the day. Part two below
  adds two more commits on top.

---
---

# Part two — the journey tree at full completion

Same day, late. Two commits, one file:

| commit | what |
|---|---|
| `6035e4f` | the canopy colour system inverted, plus four geometry faults |
| `54343f5` | fruit recomputed, and the whole thing verified at three progress states |

Seven problems were reported against a real account at 80/80. Two were not what
they looked like, one was a fix from three days earlier arriving late, and the
biggest turned out to be a constraint that only existed because of a choice made
somewhere else.

---

## 9. A constraint that was really a choice

The complaint: at 100% the three canopies were near-black, so the moment a
student finishes everything is the moment the drawing looks heaviest.

The palette block had an answer for why, and it had been sitting there in
capitals for days:

> THE CONTRAST CONSTRAINT: canopy labels are cream text sitting directly on the
> foliage, so every canopy fill — in leaf or not — has to stay dark enough to
> carry them.

That is true. Every word of it. And it had quietly set the ceiling on the whole
drawing: six fills capped near 0.48 lightness, a dormant crown pushed to a muted
bark grey, and a note explaining that pale foliage was not available because it
would leave its own labels illegible.

But look at what the constraint is anchored to. **"Labels are cream" is not a
fact about the world.** It is a choice, made early, when the foliage happened to
be dark. The constraint and the thing constraining it were pointing at each
other:

```
labels are cream  ->  foliage must be dark  ->  labels must be cream
```

Cut it anywhere and it falls apart. Labels became `var(--ink)`, the same
near-black the rest of Sprig sets type in, and the ceiling disappeared. All six
fills now sit between 0.85 and 0.91 lightness, in the mint family the product is
actually built from. Against ink at 0.26 the contrast margin is enormous, so
there is no cap at all any more.

**What replaced lightness as the grown/dormant signal is CHROMA.** A tier not
yet reached is drab, almost colourless, a ghost of a crown. A tier in leaf is
the same lightness and properly saturated. "Not grown yet" reads as colourless
rather than as dark, which is a better metaphor than the old one and, unlike the
old one, does not require the whole tree to be gloomy to express it.

**The concept, and it is the one worth carrying out of this file.** A constraint
written down in a comment is evidence that someone thought carefully, not
evidence that the constraint is load-bearing. Ask what it is anchored to. If the
anchor is another decision of yours rather than a fact about the medium, you
have a choice where you thought you had a wall.

---

## 10. "Clipped" has two causes, and only one of them is CSS

The left edge of the Application crown was being cut off. The obvious suspect is
a container with `overflow: hidden`, and the obvious move is to hunt for it in
the Tailwind classes.

Measured instead, walking the ancestors:

```
DIV.relative.mx-auto.w-full   overflow: visible/visible
SECTION.col-span-12           overflow: visible/visible
MAIN.mx-auto.grid             overflow: visible/visible
DIV.relative.min-h-screen     overflow: visible/visible
```

Nothing clips. The cut was the **SVG's own viewBox**, a second and entirely
separate clipping surface with nothing to do with CSS:

```
viewBox left edge   -150
artwork left edge   -160     <- ten units outside the window
```

Two clipping systems, both invisible in a screenshot, and the one everybody
reaches for first was innocent.

**Then the fix broke itself.** Widening the viewBox to -168 was correct when
measured, and then item 4 on the list — more space around labels — moved
`LABEL_GAP` from 30 to 42 and `LINE` from 20 to 23. The canopies are *generated
from the label boxes* (`tierPoints` into `organicBlob`), so wider labels mean
bigger crowns, and the artwork grew straight back out through the window just
fitted around it.

The comment now says so, because the dependency runs in a direction nobody would
guess from the constant's name:

> THESE TWO NUMBERS ARE DOWNSTREAM OF LABEL_GAP AND LINE. If you touch the
> spacing, re-measure the union bbox and come back here.

**The concept.** In generated geometry, layout constants are inputs to shapes
that look hand-drawn. A change that reads as purely typographic — a few units of
leading — propagates into the silhouette, its bounding box, and the frame around
it. Derived geometry needs its derivation written down at the far end, where
somebody will be standing when it surprises them.

---

## 11. The stray line was the previous fix, arriving late

A dark line appeared to poke out of the Mastery milestone. It was not a stray
element and not a rendering artifact: it was the **Mastery limb**, standing on
bare cream across the gap between the disc and its crown.

```
IV milestone disc, bottom edge      y = 151
Mastery canopy, top edge at x=684   y = 188
                                    ---------
                                    37 units of exposed branch
```

Application and Mathematics never showed it, because their crowns already reach
their discs: tops at 148 and 128 against the same 151.

**Where the 37 units came from is the uncomfortable part.** On 20 August the
three milestone discs were aligned by raising the IV disc from y=144 to y=121,
and the limb tip was raised with it so the branch still ran into the disc. The
*canopy* was not raised, because nothing in that change was about the canopy.
The gap opened then and has been there ever since.

That session verified thoroughly — label collisions, foliage ownership, lock
offsets, header baselines, all across progress states — and was completely
silent about "does each crown still reach its own milestone", because nobody had
thought to ask. Raising the top Mastery node brings its canopy to y=150 and
closes it.

**The concept.** A verification suite is a list of questions someone thought to
ask. It grows when something gets past it, and the honest reading of a passing
suite is "none of the things I know to check are broken" — never "nothing is
broken". Moving a thing means asking what was touching it.

---

## 12. When two things must match, make them the same constant

The branch lines and the rings around the nodes were different colours. The
underlying reason was that the drawing had grown three separate colour systems:
limbs mixed toward black from `--forest`, the lesson path drawn in `--mint`, and
node discs inverting depending on whether they sat on foliage or on paper.

They are one value now. Trunk, limbs, lit lesson path, node ring and canopy edge
are all `var(--forest)`: every structural line in the drawing is one colour, and
every filled area is another.

The discs stopped inverting by surface at the same time, and that had a tidy
consequence. `LessonNodeArt` took a `tone` prop purely so a locked disc could be
a darker patch of *its own* foliage. With both surfaces light and both label
colours identical, the prop had nothing left to decide, and the compiler said so
the moment the last read of it went away. Deleted.

**The concept.** Two values that must always agree should not be two values. A
comment saying "keep these in step" is a request that someone will eventually
fail; one constant referenced twice cannot drift. And when a colour decision
collapses, check what was passing that decision around — a dead parameter is
usually the last trace of a distinction that stopped existing.

---

## 13. Fruit by construction rather than by eye

The berries were unevenly scattered, and one Mastery berry sat outside its crown
entirely, on bare cream at (641, 195). They had been hand-placed against a canopy
shape that had since been reshaped several times underneath them.

Rather than nudge them, the placement was computed in the browser against the
real rendered geometry. Every point in each canopy was tested and kept only if:

- inside that canopy **and not inside a neighbouring one** — no berries in the
  overlap zones, where they read as belonging to the wrong crown,
- at least 26 units clear of the contour in all four directions,
- at least 26 units clear of every node disc and milestone,
- at least 14 units clear of every label bounding box,
- off the lesson path.

That left between 1000 and 1900 legal points per crown. Five were chosen from
each by **farthest-point sampling**: start near the middle, then repeatedly take
the candidate furthest from everything already chosen.

**The order that produces is worth as much as the positions**, and that part was
not planned. Fruit appear one per completed topic. Farthest-point ordering means
the second berry lands far from the first and the third far from both, so a
student two topics into a tier sees two berries on opposite sides of the crown
rather than two touching. The arrangement looks deliberate at every stage, not
only when full.

**The concept.** When positions must satisfy several constraints at once,
enumerate the legal region and sample it rather than guessing points and
checking them. Guess-and-check converges slowly and leaves no record; the
enumeration also tells you *how much* room there was, which is how you know
whether the result is robust or merely lucky.

---

## 14. Verifying the wrong account

Partway through checking the low and mixed progress states, the numbers refused
to move. The database said Merry Owl had four completed subtopics; the page said
eighty. Reloads, a cache-busting query string and a hard refresh all showed
eighty.

The network panel had the answer in its first request:

```
/rest/v1/students?...&id=eq.86057572-effa-40dc-b739-0e10a0282fc3
Merry Owl is           72cdffff-e450-4028-b70c-90ddf6939d75
```

The browser was signed in as **Test Student D**. Every progress write had been
landing on an account the page was not displaying.

It happened to be harmless. Test Student D is genuinely at 80/80, so the 100%
verification was against a real full account, which is what had been asked for,
and the write scripts only ever targeted Merry Owl's id, so no other account
moved. But the low and mixed states had not been exercised at all at the point
where it would have felt natural to report them as checked.

**The concept, and it generalises well past browsers.** A verification loop has
two ends: the thing you mutate and the thing you observe. Nothing anywhere
asserts they are the same object. When a change does not show up, the first
hypothesis should be "these are two different objects", well before caching,
staleness, or anything cleverer. The tell is cheap and specific: print the
identifier at the observing end and compare it with the one at the mutating end.

---

## 15. What was left undone, and why

One node keeps only **21%** of its rim on the branch beneath it: the topmost
Mastery node, where the limb has tapered to 13 units and a node disc is 30
across. Every other node is between 50% and 100%.

Closing it means widening a twig until it is as thick as the node it carries,
trading a small geometric imperfection for a tree that looks wrong. It stays as
it is, recorded here and in the commit message — a known imperfection with a
stated reason is a decision, while the same imperfection undocumented is a bug
waiting to be rediscovered.

---

## 16. Verified at three states, not one

The palette inversion touches every progress state, so 4/80, 32/80 and 80/80
were each checked on a real account rather than only the state that prompted the
work:

| state | clipped | label collisions | labels on wrong foliage | fruit outside a canopy |
|---|---|---|---|---|
| 4/80 | no | 0 | 0 | 0 |
| 32/80 | no | 0 | 0 | 0 |
| 80/80 | no | 0 | 0 | 0 |

The 4/80 pass caught something the 80/80 pass could not. With dormant chroma
taken almost to grey, the three unlit crowns were separated only by their
outlines and a hundredth of lightness each — most of the way back to the
complaint that started this whole line of work three days earlier. Lifting
dormant chroma from about 0.011 to about 0.019 keeps them drab beside a tier in
leaf while leaving them distinguishable from one another.

**A state you did not break is not a state you verified.** At 100% every canopy
is grown, so the dormant colours are not drawn at all, and no amount of staring
at that screen would have shown it.

---

## The thread

Both halves of today land in the same place, one level apart.

The morning's three bugs each needed a different instrument:

- The dropped argument was invisible in the source (the code reads correctly)
  and visible only in the error text of a call that failed for an unrelated
  reason.
- The error-passthrough bug was invisible in the error text (it looked like a
  message) and visible only in the error *code*.
- The copy bug was invisible in both, and visible only by asking what the
  sentence claims and whether anyone could check it.

The evening's were about something slightly different — not which instrument to
reach for, but **whether the thing you are looking at is the thing you think it
is**:

- The dark canopy was not a constraint, it was a choice pointing at itself.
- The clipping was not the container everyone checks, it was a second clipping
  surface in a different technology.
- The stray line was not a stray element, it was a fix from three days ago
  showing up late.
- The stuck progress numbers were not caching, they were a different student.

Neither list is found by re-reading more carefully. The first needs a different
question asked on purpose; the second needs the question you already asked to be
pointed at the right object.
