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
- `main` is at `36da2ed` and pushed.

---

## The thread

The 20 August log ended on needing a different *kind* of check for each kind of
bug. Today repeats it in a smaller space:

- The dropped argument was invisible in the source (the code reads correctly)
  and visible only in the error text of a call that failed for an unrelated
  reason.
- The error-passthrough bug was invisible in the error text (it looked like a
  message) and visible only in the error *code*.
- The copy bug was invisible in both, and visible only by asking what the
  sentence claims and whether anyone could check it.

None of the three is found by re-reading more carefully. Each needs a different
question asked on purpose.
