# Technical log — 8 August 2026

## What we did today

Closed a gap in the teacher audit trail: `teacher_unlock_student()` and
`teacher_reset_pin()` only ever wrote a `teacher_actions` row when the action
actually succeeded. A *refused* attempt — a teacher probing a student that
isn't theirs, or hitting the 40/hour rate limit — left no trace at all. Fixed
by changing how the two functions report a refusal (a return value instead
of a raised exception, and why that distinction turns out to matter a lot in
Postgres), adding an `outcome` column to record which kind of row it is, and
verifying the fix against a real cross-teacher attempt rather than trusting
that the migration merely *ran*.

---

## 1. Why "insert the log row, then raise" doesn't work

The obvious-looking fix is the wrong one, and it's worth understanding why,
because the reason is a genuinely useful fact about how transactions work.

`teacher_unlock_student()` used to look like this:

```sql
if not public.teacher_owns_student(p_student_id) then
  raise exception 'That student is not yours to unlock.';
end if;
```

The tempting fix is to slot an `insert` in right before the `raise`:

```sql
if not public.teacher_owns_student(p_student_id) then
  insert into public.teacher_actions (...) values (..., 'refused');
  raise exception 'That student is not yours to unlock.';  -- rolls back the insert too!
end if;
```

This doesn't work, and the reason is that a Supabase RPC call — the thing
`supabase.rpc("teacher_unlock_student", ...)` triggers from the browser — is
**one transaction**. Everything a function does between its `begin` and its
`end` either all commits together or all rolls back together; there's no
partial credit. When `raise exception` isn't caught by anything, Postgres
aborts the whole transaction, and "the whole transaction" includes the
`insert` that ran two lines earlier in the very same function call. The log
row and the refusal are created and destroyed in the same breath.

This is a real constraint, not a bug to route around cleverly — Postgres
doesn't have a lightweight way to say "commit *this* part regardless of what
happens next" from inside a single function invocation. (There are heavier
tools for that — an autonomous transaction via a second database connection
— but they trade a credential-management problem for the one being solved,
which is a bad trade for a two-function audit-log fix.)

**The general lesson:** when something needs to survive a failure that
happens *after* it, ask whether it's genuinely inside the same transaction as
that failure. If it is, no amount of "just insert it earlier" fixes it — the
insert and the failure share a fate no matter what order they're written in.

---

## 2. Turning expected refusals into return values instead of exceptions

The actual fix: stop treating "not your student" and "too many actions this
hour" as *exceptions* at all. They're not surprises — they're the normal,
foreseeable output of a security check that's specifically designed to say
no sometimes. The codebase already had a name for this pattern:
`fetchTeacherStudents()` in `src/lib/teacherAuth.ts` never throws; it returns
`{ok: true, students}` or `{ok: false, message}` and lets the caller decide
what to do. Genuinely unexpected failures — a dropped connection, a missing
grant — are a different category, and those still raise and still go
unlogged, exactly as before.

So both functions changed shape. `teacher_reset_pin()` already returned
`jsonb`, so its body could just change what it returns:

```sql
if not public.teacher_owns_student(p_student_id) then
  insert into public.teacher_actions (teacher_id, student_id, action, outcome)
  values (auth.uid(), p_student_id, 'reset_pin', 'refused_not_owner');
  return jsonb_build_object('ok', false, 'message', 'That student is not yours to reset.');
end if;
```

Now the `insert` and the "no" both happen inside a function call that
**completes successfully** — nothing raises, so nothing rolls back, so the
log row is exactly as durable as a successful action's row.

`teacher_unlock_student()` used to `return void`, and Postgres won't let
`create or replace function` change a function's return type in place — you
have to `drop function` and recreate it. The migration does that explicitly,
and re-adds the `grant execute ... to authenticated` that gets dropped along
with the old function (a grant is attached to the specific function
signature, not the name — dropping the function drops the grant with it).

This ripples up to the browser. `src/lib/teacherAuth.ts` used to rely on
Supabase turning a raised Postgres exception into `{error}` on the client:

```ts
const { error } = await supabase.rpc("teacher_unlock_student", { p_student_id: studentId });
if (error) return { ok: false, message: readableError(error.message) };
```

Now the expected refusals arrive as ordinary `data`, not `error`:

```ts
const { data, error } = await supabase.rpc("teacher_unlock_student", { p_student_id: studentId });
if (error) return { ok: false, message: readableError(error.message) };

const result = data as { ok: boolean; message?: string };
if (!result.ok) return { ok: false, message: result.message ?? "Something went wrong. Try again in a moment." };
```

One nice side effect: `readableError()` used to guess whether a raw Postgres
error message was one of three known, human-written strings, by checking
whether it *contained* a fragment like `"not yours to unlock"`. That
substring-matching is gone now — the known messages arrive as `data.message`
verbatim, so `readableError()`'s only job left is the honest one: anything
that reaches it is a genuine surprise, log it and show a generic message.

**The general lesson:** "raise an exception" and "return a failure value"
aren't interchangeable ways of saying the same thing, even though both end
up showing the user an error message. They have different transactional
consequences — an exception unwinds everything since the last commit; a
return value doesn't unwind anything. When you need something to survive
alongside a failure, that difference is the whole ballgame.

---

## 3. The schema: one column, and a deliberately accepted gap

`teacher_actions` gained a single column rather than a second table:

```sql
alter table teacher_actions
  add column outcome text not null default 'succeeded'
    check (outcome in ('succeeded', 'refused_not_owner', 'refused_rate_limited'));
```

A refusal and a success are the same *kind* of fact — "an attempt happened,
here's what came of it" — and both places that read this table (a teacher's
own history, and the 40/hour budget check counting rows in the last hour)
already scan across all of them together. A separate table would mean a
`union` at every one of those call sites for no real benefit. The existing
default backfills every pre-migration row to `'succeeded'`, since those were
all written by code that only ever inserted on the success path; the default
is then dropped so nothing written from here on can accidentally omit an
outcome.

One consequence worth naming on purpose: `teacher_action_budget_ok()` counts
*every* row in the last hour, regardless of outcome, so refused attempts now
spend the same budget a real action would. That's a genuine improvement —
today, probing costs nothing, because nothing got inserted on refusal, so an
account fishing for other teachers' student ids could never trip the rate
limiter. Counting refusals means probing throttles itself.

**The FK edge case.** `student_id` has `references students(id)` — a real
constraint, not just documentation, meaning Postgres physically refuses to
insert a row pointing at a `student_id` that doesn't exist. That's fine for
a *targeted* refusal (a real student, just not this teacher's), but a
*blind* probe — a fabricated UUID that isn't any student at all — would
throw a foreign-key violation on the very `insert` meant to log it. The fix
wraps that one insert in a small exception handler:

```sql
begin
  insert into public.teacher_actions (teacher_id, student_id, action, outcome)
  values (auth.uid(), p_student_id, 'unlock', 'refused_not_owner');
exception when foreign_key_violation then
  null; -- nothing to attach the row to; see the comment in the migration
end;
```

So a probe against a real (but not-owned) student id gets logged; a probe
against a UUID that names no student at all doesn't. That's an accepted gap,
not an oversight — student ids are random UUIDs, effectively unguessable, so
blind enumeration isn't a realistic way to find a real target in the first
place. It's a deliberate, named trade-off rather than a silent one.

**The general lesson:** a foreign key is a promise the database enforces
even in your own error-handling code. If the thing you're trying to log
about might not exist, logging it isn't free — you have to decide, on
purpose, what happens when the reference doesn't resolve, rather than
discovering it the first time a garbage id crashes the code path that was
supposed to record garbage ids.

---

## 4. Verifying with an actual refusal, not just a clean migration run

"Success, no rows returned" from the SQL editor only proves the DDL parsed —
it says nothing about whether a refused call actually gets logged correctly.
Given this project's own stated rule about these functions (`teacher_reset_pin()`'s
failure mode is silent — verify by signing in with the new PIN, never by the
function returning cleanly), the same caution applied here: prove the
refusal behaves as designed, using a real second teacher account.

**Setup.** `scripts/create-teacher.ts` created a throwaway
`test-teacher-2@sprig.study` — a real `auth.users` row plus a real
`teachers` row, no different from a real teacher account except that it was
made purely to be deleted afterward. A read-only script (service-role key,
`select` only) listed the existing teachers and their students to find a
target: a real student ("Wandering Hedgehog") belonging to the actual
teacher account used for this project, `you@school.uk`.

**The probe.** A small script signed in as `test-teacher-2` with the
*publishable* key — the same key and the same `signInWithPassword()` flow
the real login page uses, not the service-role key, since the point was to
exercise exactly the code path a real browser session would — and called
both RPCs against that student id:

```
error: null
data: { ok: false, message: 'That student is not yours to unlock.' }
```

`error: null` is the important part: nothing raised, the call completed
normally, and the refusal is just an ordinary value the client can inspect —
exactly the contract change from section 2.

**Confirming the log row.** `service_role` turned out *not* to have a
`select` grant on `teacher_actions` — only `authenticated` does, via the
"Teachers read own actions" RLS policy (`auth.uid() = teacher_id`). That's
consistent with the table's whole design (nobody, including an admin
connection without the right grant, gets to casually read it), so the
correct way to check was to read it *as* `test-teacher-2` — the only session
entitled to see its own rows:

```
teacher_id: a65decb7-…  student_id: 4ec71da3-…  action: unlock      outcome: refused_not_owner
teacher_id: a65decb7-…  student_id: 4ec71da3-…  action: reset_pin   outcome: refused_not_owner
```

Both refusals — `teacher_unlock_student` and `teacher_reset_pin` — produced
exactly one row each, correctly attributed to the *attempting* teacher, with
the target's real id preserved.

**Confirming nothing else moved.** The refused `teacher_reset_pin` call, if
it had gone wrong, could have rewritten the target's password hash, flipped
`must_change_pin`, or killed their sessions. A direct read of the student row
afterward showed it untouched — which is guaranteed by the code structure,
not just observed by luck: both guards `return` immediately on refusal,
before any of those statements are reached, so there's no code path where a
refusal could partially apply.

**Cleanup.** `test-teacher-2` was deleted via
`admin.auth.admin.deleteUser(id)`. `teachers.id` has `references
auth.users(id) on delete cascade`, so deleting the `auth.users` row cascaded
through the `teachers` row and, via `teacher_actions.teacher_id references
teachers(id) on delete cascade`, both test rows too — one call cleaned up
every trace of the throwaway account, its login, and its two logged probes.

**The general lesson:** a migration completing without error proves the SQL
was syntactically valid; it proves nothing about whether the *behavior* it
was meant to produce actually happens. The only way to know a refusal gets
logged is to cause a real refusal and look at what landed — using the same
client, the same key, and the same auth flow a real attacker or a real
teacher would use, not an admin connection that bypasses the exact checks
being tested.

---

## What was verified

| Check | Result |
|---|---|
| Migration applies cleanly (`outcome` column, both functions recreated) | ✅ |
| `teacher_unlock_student()` return type actually changed to `jsonb` | ✅ |
| Grants survived the drop-and-recreate of `teacher_unlock_student()` | ✅ `authenticated` can still execute |
| `pg_proc` / `has_function_privilege` spot-check | ✅ |
| Cross-teacher `teacher_unlock_student` call | ✅ refused — `error: null`, `data.ok: false`, correct message |
| Cross-teacher `teacher_reset_pin` call | ✅ refused — same shape |
| Refusal produces exactly one `teacher_actions` row, correct `outcome` | ✅ `refused_not_owner` × 2 |
| Refused row readable by the attempting teacher's own session (RLS) | ✅ |
| `service_role` can read `teacher_actions` directly | ❌ no grant — by design; had to read as the teacher instead |
| Target student's row (`must_change_pin`, PIN hash, sessions) unaffected by the refusal | ✅ confirmed by direct read, and guaranteed by code structure (early `return`) |
| Throwaway `test-teacher-2` account and its two test rows fully removed | ✅ single `deleteUser()` call, cascaded through `teachers` and `teacher_actions` |
| TypeScript typecheck (`tsc --noEmit`) | ✅ |
| Lint (`oxlint`) on the changed file | ✅ |
| Committed and fast-forwarded into `main` | ✅ `c18e0ad` |
