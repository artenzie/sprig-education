# Technical log — 27 July 2026

## Teacher accounts, and the two things a teacher can actually do

Until today, a student who could not log in was stuck, and so was their teacher.
There were exactly two reasons that happened, and neither had a remedy:

1. **Locked out.** Five wrong PINs locks a nickname for fifteen minutes. Nothing
   could lift that early — `login_attempts` has RLS on with no policies and no
   grants, withheld *even from `service_role`* on purpose, and
   `clear_login_attempts()` needs the student's own session, which is precisely
   what they cannot get while locked.
2. **Forgotten PIN.** The PIN is a bcrypt hash in `auth.users`, unreadable by
   anyone including us. That was the whole point of moving onto Supabase Auth.
   Resetting one normally means the admin API, which means the service-role key,
   which can never go near a browser.

The 25 July log left a comment in `AuthProvider.tsx` explaining why the lockout
message deliberately did *not* say "ask your teacher", and ended:

> Restore that sentence once teacher tooling can actually clear a lock.

This session is that tooling. The sentence is back.

---

## 1. The keystone, for the second time

`teachers` had sat untouched since 21 July carrying a `password text` column —
the sketch of a hand-rolled credential store we would have had to hash, salt,
compare and rotate ourselves. `students` stopped doing that on 25 July. Today
`teachers` did the same, and the migration is deliberately shaped line-for-line
like the one that did it for students:

```sql
alter table teachers drop column if exists password;
alter table teachers alter column id drop default;
-- ... then a guarded:
alter table teachers
  add constraint teachers_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
```

Those three statements are the entire idea. `teachers.id` **stops generating its
own uuid and instead IS the auth user's id.**

Why that matters so much is worth saying plainly, because it is the same insight
the student work turned on and it is easy to skim past. `auth.uid()` is a
function that reads the user id out of the JWT the browser sent. Supabase signed
that token, so the browser cannot forge it. If `teachers.id` is that same id,
then `auth.uid() = teacher_id` is a *complete* ownership check — no join to a
session table, no lookup, no trust placed in anything the client said about
itself.

Everything else in this session is a consequence of that one line.

**The general lesson:** when you can make two identifiers the same identifier,
do it. Every place they would otherwise have to be reconciled becomes a place a
bug can live.

---

## 2. Grants and policies are two different checks

This project has now been bitten three times by the same thing, so it is worth
stating as a rule rather than a war story.

Before a signed-in user can touch a table, Postgres checks **two** independent
things:

1. **A table-level GRANT.** Checked *first*, before RLS is considered at all.
   Missing it gives you `42501 permission denied for table X` — a hard error,
   not an empty result.
2. **An RLS policy.** This decides *which rows*.

They fail differently and that is the tell. If you get an **error**, you're
missing a grant. If you get an **empty array**, you're missing a policy (or your
policy is correct and there genuinely are no rows).

We used both failure modes deliberately during verification. From a student
session:

```
teachers        →  200  []      ← has a grant; policy correctly matches nothing
login_attempts  →  403  42501   ← no grant at all; RLS never even runs
```

That contrast is not an accident of configuration. `teachers` is readable-in-
principle and empty-in-practice for a student; `login_attempts` is unreachable
in principle, by anybody, through any client.

### Two policies on one table

The interesting policy is the second one on `students`:

```sql
create policy "Teachers read their own students" on students
  for select to authenticated
  using ((select auth.uid()) = teacher_id);
```

It sits alongside the existing `"Students read own row"`. **Multiple policies for
the same command are OR'd together**, so you have to convince yourself this
widens nothing:

- A student's `auth.uid()` is never any row's `teacher_id` (teacher ids and
  student ids are different auth users), so they still see exactly one row.
- A teacher's `auth.uid()` is never any row's `id`, so they see exactly their
  class.

No grant was needed — `grant select on students to authenticated` already existed
from 25 July. Adding a policy to a table that is already granted is a one-line
change, which is exactly why you have to think about the OR.

---

## 3. `SECURITY DEFINER`: doing what your caller cannot

A teacher needs to cause two effects they have no permission to perform:

- delete a row from `login_attempts`, which no client can touch;
- rewrite a bcrypt hash in `auth.users`.

The tool for this is a `SECURITY DEFINER` function. Normally a function runs with
the privileges of whoever *called* it. A definer function runs with the
privileges of whoever *owns* it. So the function can do the privileged thing —
and the function body decides, in the database, whether this particular caller
is entitled to this particular effect.

This is the same pattern as `complete_pin_change()` from 25 July. What is new
here is that the stakes are higher, so the guards were pulled out into one
shared place rather than written per function:

```sql
create or replace function public.teacher_owns_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.students s
      join public.teachers t on t.id = s.teacher_id
     where s.id = p_student_id
       and t.id = auth.uid()
  )
$$;
```

Two details in there are load-bearing:

**It takes a student id and nothing else.** There is deliberately no
`p_teacher_id` parameter. Offering one would mean trusting the browser to name
itself, which is the entire class of bug this design exists to make impossible.
The teacher comes from `auth.uid()`, full stop.

**The join through `teachers` looks redundant and isn't.** `s.teacher_id =
auth.uid()` alone would nearly work, but the join also proves *the caller is a
teacher*. Students are `authenticated` too. This way a student session fails
structurally rather than incidentally.

### `set search_path = ''`

Every definer function has it, and it is not decoration. Without it, the caller
controls where an unqualified name like `students` resolves — and could point it
at a table of their own making. With an empty search path nothing resolves
implicitly, which is why every single name in these migrations is
schema-qualified, right down to `extensions.crypt()`.

**The general lesson:** `SECURITY DEFINER` is how you lend privilege
deliberately. `set search_path = ''` is how you stop the borrower redirecting it.

---

## 4. Why the ownership check is not in React

`RequireTeacher.tsx` redirects non-teachers away from `/teacher`. It would be
easy to think that is the security boundary. It is not, and the file says so:

> Deleting this file would make the app rude, not insecure.

Anyone can edit their way past a client-side redirect. What actually stops a
student is that the roster is filtered by an RLS policy and the two actions are
refused by `teacher_owns_student()` — both in the database, both unreachable
from the browser's devtools.

We proved this rather than asserting it. From a signed-in *student* session,
calling the RPCs directly over HTTP:

```
teacher_unlock_student(own id)  →  400  "That student is not yours to unlock."
teacher_reset_pin(own id)       →  400  "That student is not yours to reset."
```

Note they could *reach* the functions — those are granted to `authenticated`,
and a student holds a valid JWT. They were refused by the guard, which is the
design working, not the design being lucky.

---

## 5. Resetting a PIN: four writes that must happen together

`teacher_reset_pin()` is the most involved function here, and its shape is
instructive. It does four things, and missing any one leaves a reset that
half-works in a way that is maddening to diagnose from the front of a classroom:

1. **The credential.** `encrypted_password = extensions.crypt(v_pin,
   extensions.gen_salt('bf'))` — the same bcrypt GoTrue uses, so the student's
   next sign-in verifies against it as if Supabase had written it.
2. **`must_change_pin = true`.** A PIN read aloud across a classroom is not a
   secret. `RequireAuth` funnels them through `/set-pin` before anything else,
   exactly as it does for a new account on `000000`.
3. **Clear the lockout.** A student who forgot their PIN has almost certainly
   just guessed at it five times. Handing them a new PIN they cannot use for
   another quarter of an hour would look exactly like the reset having failed.
4. **Kill live sessions.** Changing a password does *not* invalidate sessions
   already issued against the old one. Without `delete from auth.sessions`,
   whoever was signed in stays signed in — which defeats the point of resetting a
   credential that may have been shared or guessed.

### The bit that deserves suspicion

Step 1 reaches into Supabase's `auth` schema, which Supabase discourages. The
supported route is an Edge Function holding the service-role key. That is the
same upgrade path the lockout migration already names for its own weaknesses, and
the two should be done together.

Until then, this is the free-plan answer, and **its failure mode is the reason
verification had to be done a particular way**: if a future GoTrue changed how
passwords are stored, the `update` would still *succeed* and the student still
would not be able to log in. A green tick in the UI would prove nothing.

So the check was never "the function returned without error". It was:

1. Reset Test Student B's PIN → UI showed `REDACTED-PIN`.
2. Try the **old** PIN `000000` → *"That nickname and PIN don't match."* ✅
3. Try `REDACTED-PIN` → signed in, landed on `/set-pin`. ✅

Only step 3 proves anything. Steps 1 and 2 are the setup.

**The general lesson:** when a failure mode is silent, verify the *effect*, not
the *call*. Ask what would still look fine if this were broken, and go test that
instead.

---

## 6. Blast radius: what a stolen teacher password buys

Worth being honest rather than reassuring, because a teacher account is now the
most valuable credential in the system.

**Bounded:**

- To one class. Every function derives the teacher from the JWT and checks
  ownership server-side. Verified: teacher 2 calling either RPC against teacher
  1's student is refused.
- No credential is readable. Reset only ever *writes* a new PIN; the return value
  is the one moment it exists in plaintext, and it is never stored.
- No blanket admin. Three teacher-callable functions, two read policies. No
  delete, no student creation, no progress access, no service-role key anywhere
  near the browser.
- Capped at 40 actions/hour, and every one is logged.

**Not bounded, and this is inherent:** a teacher who resets a PIN can then sign
in as that student. That is the same power they have standing next to the laptop.
The ceiling is one class's lesson progress attached to a random nickname with no
personal data whatsoever — and *that anonymity is what makes this proportionate*.
The design decision to never collect real names is doing security work here, not
just privacy work.

---

## 7. The audit trail, and a known limitation

`teacher_actions` records every action, and its grants are the interesting part:

```sql
grant select on teacher_actions to authenticated;   -- read your own
-- ...and nothing else. No insert grant, ever.
```

The only inserts that can happen are the ones the definer functions make as the
table's owner. A teacher cannot forge a record of something they did not do, and
— the part that matters — cannot erase a record of something they did. Verified
directly: a `POST` to `/rest/v1/teacher_actions` from a teacher session returns
`42501`.

### The limitation

**`teacher_actions` records successes only.**

Both guards `raise exception` *before* the insert, so a refused call writes
nothing. During verification, four calls were refused — two from a student
session, two from teacher 2 — and the table ended with exactly two rows, both
from the successful unlock and reset.

That is correct in the sense that nothing happened, so nothing is recorded. But
it means the log answers *"what was done"* and not *"what was attempted"*. Someone
probing with a stolen teacher account — walking uuids looking for one that
belongs to them — leaves no trace at all until they find one.

Not urgent: the probe achieves nothing, and the rate cap still applies to
successful actions. But if the log is ever meant to support "was this account
misused?", it needs an attempted-and-refused row too. Logging refusals means
inserting before the `raise`, which means the insert must survive the rollback —
so it wants an `exception` block or an autonomous write, not just a reordering.
That subtlety is why it is a follow-up and not a two-line fix.

---

## 8. A bug found by using the thing

While creating test fixtures, `create-students.ts` reported writing to
`students-2026-07-27.csv` — twice, for two different batches. It hadn't:

```
students-2026-07-27.csv     Wandering Hedgehog, Restless Otter, Test Student B
students-2026-07-27-2.csv   Gentle Heron
```

The script wrote to `appendSuffixIfExists(path)` but interpolated the
*un-suffixed* `path` into the message. So a second batch on the same day lands in
`-2.csv` while the teacher is told to open the original — which still holds the
**previous** batch. Follow that message in a classroom and you hand out nicknames
belonging to students who already have them.

The fix hoists the real filename into a variable used in both places. The comment
explaining why the two must stay in step matters as much as the fix: the bug is
invisible on any single-batch day, so it would be easy to "simplify" straight
back into it.

**The general lesson:** this was invisible to the type checker, invisible to
lint, and invisible to any single run. It surfaced only because the script was
run twice in one day with real intent. Some bugs are only reachable by *use*.

(Related: `tsconfig.app.json` only includes `src`, so `npm run build` never
typechecks `scripts/`. Running them is the only real check they get.)

---

## 9. What was verified, and what wasn't

Everything below was done in a browser against the live database, not reasoned
about:

| Check | Result |
|---|---|
| Teacher login → `/teacher` | ✅ |
| Roster scoped to own class | ✅ 3 and 2, no overlap |
| Lockout after 5 wrong PINs | ✅ counter ran down, then locked |
| Teacher sees `LOCKED · 15 MIN LEFT` | ✅ Unlock on that row only |
| Unlock → immediate sign-in | ✅ no wait |
| Reset PIN, proven by signing in | ✅ old rejected, new accepted |
| Student calling teacher RPCs | ✅ refused, incl. own id |
| Teacher 2 → teacher 1's student | ✅ refused |
| Student reads | ✅ own row only; `login_attempts` `42501` |
| `teacher_actions` insert from browser | ✅ refused `42501` |
| Student regression (PIN → dashboard) | ✅ |
| Teacher hitting `/dashboard` | ✅ → `/teacher` |

The Unlock button appearing on one row and not the others is worth calling out as
a small proof in itself: that data comes from `login_attempts` via
`teacher_student_lockouts()`, and there is no path by which the browser could
have learned it any other way.

**Not done, and deliberately:** teachers still have **no** access to `progress`,
`test_attempts` or the check-ins. A teacher can see that a student exists, what
they are called, and whether they still owe a PIN change — and not one answer,
score or mood. Showing a teacher their class's progress is separate work, and it
needs its own thinking about what the teacher of a deliberately anonymous student
ought to be able to see.

---

## 10. Two things about verifying with a browser

**Automation can lie about form state.** Setting an input's `value` directly
fills it visually, but React's controlled inputs ignore it — the component's
state stays empty. The form *looked* filled and submitted nothing. Real
keystrokes fixed it. If a form appears populated and behaves as if it is empty,
suspect this before suspecting the form.

**Check the pre-flight assumptions before running migrations.** Three checks ran
first: pgcrypto's schema, a bcrypt round-trip, and whether the function owner can
write to `auth.users` *and* `auth.sessions`. The reason is timing — plpgsql
function bodies are **not** validated at creation, so a wrong schema or a missing
grant would not fail when the migration was pasted in. It would fail the first
time a teacher pressed "Reset PIN", in front of a class.

The same reasoning made `select public.random_student_pin()` the single most
useful post-migration check: it forces the one piece of SQL that couldn't be
verified statically — the `('x' || encode(...))::bit(32)::bigint` idiom — to run
somewhere cheap.

**The general lesson:** find out *when* a mistake would surface, then arrange to
find out sooner.
