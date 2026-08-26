# Technical log — 26 August 2026

## What this session was

No features. This was the session where Sprig stops being a project under
construction and starts being a thing that other people are about to use. Three
jobs: clear the leftovers out of the repo, clear the fake accounts out of the
live database, and change the host password.

None of that is glamorous, but the second one is genuinely irreversible and the
third one locks you out if it goes wrong, so most of the thinking below is about
*how to do a destructive thing safely* rather than about what was deleted.

---

## Part 1 — the repo

### The finding was mostly "nothing to do"

The instinct with a cleanup task is to start deleting. The better first move is
to prove what is actually dead, because "looks unused" and "is unused" are
different claims. Three checks:

- **Unreferenced modules.** For every tracked file under `src/`, grep the rest
  of `src/` for its import name. Anything with zero hits is a candidate.
- **Unused dependencies.** For every entry in `package.json`, grep the source
  for it — remembering that some are used from CSS (`katex`, `tw-animate-css`
  are `@import`ed in `src/index.css`, not imported in TypeScript) and some from
  config (`@tailwindcss/vite` appears only in `vite.config.ts`).
- **Stray files.** `find` for `*.bak`, `*.orig`, `~$*`, `*.tmp`.

All three came back clean. That is worth stating plainly rather than inventing
work: the codebase had no dead modules and no unused dependencies.

### The one false positive, and why it mattered

The module scan initially flagged `src/context/AuthProvider.tsx` as
unreferenced. It is imported by `src/main.tsx` and is the root of the entire
auth tree — deleting it would have broken the app completely.

The bug was in the grep, not the code: the search pattern looked for the module
name followed by a quote, and `main.tsx` writes the import with a file
extension:

```ts
import { AuthProvider } from './context/AuthProvider.tsx'
```

so `AuthProvider'` never matched — the quote comes after `.tsx`, not after
`AuthProvider`.

**The lesson is about the shape of the error, not the regex.** A "find dead
code" script fails in one of two directions, and they are not equally bad:

- A **false negative** leaves a dead file in the repo. Cost: some clutter.
- A **false positive** tells you a live file is dead. Cost: you delete the root
  of your auth system.

So a tool like this must never be trusted as the final word. Every hit gets
confirmed by hand before anything is removed, which is exactly what caught this
one.

### What was actually removed

| Item | Tracked in git? | Why |
|---|---|---|
| 7 × `students-*.csv` | No (gitignored) | PIN hand-out lists for the accounts deleted in Part 2 |
| `rls-baseline.json` | No (gitignored) | RLS snapshot tied to those same throwaway accounts |
| `dist/` (2.3 MB) | No (gitignored) | Stale local build; Vercel builds its own |
| `src/components/.gitkeep` | **Yes** | Kept an empty directory in git; directory is no longer empty |

Only the last one is a commit. The rest were already invisible to git.

`rls-baseline.json` deserves a note, because it shows how a local artifact rots
silently. It recorded the host user as `555e88dc-…`. The host account is
`d660a9c3-…`. That id had not existed for weeks — the baseline was already
comparing against a world that was gone, and `check-rls.ts --baseline` would
have "passed" or "failed" for reasons that had nothing to do with the policies.
A stale baseline is worse than no baseline, because it produces confident
answers to the wrong question.

### What was deliberately kept

- **The 22 `TECHNICAL_LOG_*.md` files** — the point of the exercise.
- **`scripts/check-rls.ts` and `scripts/change-teacher-email.ts`** — neither is
  wired into `package.json`, which makes them *look* like scratch. They are not:
  one proves RLS still holds, the other fixes a teacher's email. Both are more
  useful during a pilot than before one. "Not referenced by a build script" is
  not the same as "not needed".
- **`src/components/sprig/growth-check-parked.tsx`** — the name says parked; the
  file is imported by both `Progress.tsx` and `GrowthChart.tsx`. It is live code
  with a misleading name, which is a rename, not a deletion. Left alone
  deliberately: a cleanup session is the *worst* time to do a rename, because
  every other change in the commit is a deletion and a rename hidden among them
  is easy to misread.

---

## Part 2 — the database

### What was in there

15 students, 3 teachers, 281 progress rows, 13 test attempts, 2 check-ins, 1
help message. Every single student account was a test account — 14 of them
traceable to the `students-*.csv` files, plus Merry Owl. There was no real
student data to protect, which is a good position to be in on 26 August and
would not have been on 26 September.

Two of the three teachers were fakes (`you@school.uk` / "Test School",
`other@school.uk` / "Other School"). The third is the real host account.

### Reading the schema before writing the delete

The first inventory script failed on three tables:

```
progress=ERR: daily=ERR: weekly=ERR:
```

Not a permissions problem — a schema assumption. The script counted rows with
`.select("id", { count: "exact", head: true })`, and those three tables have no
`id` column. From `20260721000000_init_schema.sql`:

```sql
create table if not exists progress (
  student_id uuid not null references students(id),
  subtopic_id uuid not null references subtopics(id),
  ...
  primary key (student_id, subtopic_id)
);
```

A **composite primary key**. One progress row per student per subtopic, so the
pair *is* the identity and a synthetic `id` would add nothing. Same for
`daily_checkins` (student + date) and `weekly_checkins` (student + week).
`test_attempts` *does* have an `id`, and the schema comment says exactly why: a
student can attempt the same test type repeatedly, so there is no natural key.

This is worth internalising, because the failure was silent in the worst way.
Supabase returned the error in a field the script printed as empty, so the first
run reported `progress=ERR:` — and a slightly lazier script would have printed
`progress=0` and been believed. **A count of zero and a failed count must never
look the same.** If they do, you will delete something on the strength of a
number you never actually measured.

### Why deleting the auth user is enough

The instinct is to delete child rows first, then parents. Not needed here, and
understanding why is the useful part.

The migration `20260815000000_cascade_student_deletes.sql` gave all four child
tables `on delete cascade` on `student_id`, and `20260725000000` made
`students.id` a foreign key to `auth.users(id)`, also cascading. So there is a
chain:

```
auth.users  →  students  →  progress
                        →  test_attempts
                        →  daily_checkins
                        →  weekly_checkins
                        →  teacher_actions
```

Deleting one `auth.users` row makes Postgres walk that entire chain. One admin
call per account removed everything the account had ever produced. The verify
step confirmed it: 281 progress rows went to 0 without a single progress query
being written.

### The one thing that did not cascade — and it was deliberate

`help_messages` does **not** cascade. It is `on delete set null`, and the
migration explains itself:

```sql
-- `on delete set null` rather than cascade, deliberately, and it is the one
-- exception to yesterday's cascade migration. A student leaving should not
-- silently destroy a question that may still be unanswered, and once the id
-- is gone the row carries nothing that identifies anybody.
```

That is a real design decision, not an oversight — a student deleting their
account should not destroy an unanswered support question, and a message with a
null `student_id` is fully anonymous anyway. But it meant Test Student D's test
message (content: `"Test 4"`) would have survived the purge as an orphan, which
is why it was deleted explicitly.

**This is the general shape of the problem: cascades clean up what is *owned*,
not what merely *refers*.** Anything deliberately non-cascading has to be
handled by hand, and the only way to know which is which is to read the
constraints.

### Safety measures, and why each one

1. **Backup first.** Every table dumped to JSON in the scratchpad before
   anything was deleted. It matched the inventory exactly (281 progress rows,
   13 attempts), which incidentally proved the inventory was reading the
   database correctly.
2. **Explicit id list.** The delete script hard-codes 15 student ids and 2
   teacher ids. It does not select-then-delete. A query that decides *at run
   time* what to remove — `where nickname like '%Test%'`, say — is a query whose
   blast radius depends on data you cannot see when you approve it.
3. **A guard on the host.** Before deleting anything, the script checks the host
   id against every entry in both lists and aborts if it appears:

   ```js
   for (const [id, label] of [...STUDENTS, ...TEACHERS]) {
     if (id === HOST_ID) { console.error("ABORT: host id in delete list"); process.exit(1); }
   }
   ```

   Redundant, since the lists were written by hand and inspected. Redundancy is
   the point — the check costs nothing and the failure it prevents is
   unrecoverable.
4. **Verify by re-querying.** Not by trusting that the deletes returned without
   error. Final state: 0 students, 0 progress, 0 attempts, 0 check-ins, 0 help
   messages, 1 teacher — the host.

### One table that could not be checked

`teacher_actions` refused to be read at all:

```
permission denied for table teacher_actions (42501)
hint: GRANT SELECT ON public.teacher_actions TO service_role;
```

Even the service-role key — the key that bypasses RLS — cannot read it. That is
the lockdown in `20260725030000_service_role_grants.sql` working: RLS and
table-level grants are *different mechanisms*, and `service_role` bypassing the
first does not give it the second.

The right response was to leave it alone. It cascades on student delete, so it
cleaned itself up, and the tempting fix — granting SELECT so the audit could be
eyeballed — would have permanently widened access to a table of teacher audit
records in exchange for one moment of curiosity during a cleanup.

---

## Part 3 — the password, and a change of approach mid-task

The original plan was the obvious one: generate 24 random characters, call
`updateUserById`, print it once. Then the requirement changed — the password
should be typed in, not generated and displayed.

That is a better requirement, and the reason is worth spelling out. **A
generated password has to be displayed to be useful.** Displaying it puts it in
the terminal scrollback, in the session transcript, and in anything that logs
either. Fine for a password being handed to someone else, who has to receive it
somehow. Pointless risk for your own, which you are going to type into a
password manager anyway.

So: `scripts/set-host-password.ts`. The password is never displayed, never
passed as an argument, and never written to a file. Three separate leaks closed:

- **Not an argument**, because `argv` is world-readable on most systems and
  `node ... --password hunter2` lands in `.bash_history` permanently.
- **Not a file**, because files persist and get backed up.
- **Not echoed**, because scrollback persists too.

### Hiding terminal input

Node has no `getpass`. Reading a line normally echoes it, because the *terminal
driver* does the echoing, not your program. Turning it off means raw mode:

```ts
stdin.setRawMode(true);
```

Raw mode stops the driver echoing — and also stops it handling everything else.
Enter no longer ends a line, Backspace no longer erases, Ctrl-C no longer
interrupts. Every one of those becomes a byte your program has to handle:

```ts
if (char === CARRIAGE_RETURN || char === LINE_FEED) { /* submit */ }
if (char === CTRL_C || char === CTRL_D)             { /* abort  */ }
if (char === DELETE || char === BACKSPACE)          { /* erase  */ }
if (char >= SPACE) value += char;
```

That last line matters more than it looks. An arrow key does not arrive as "an
arrow key" — it arrives as a three-byte escape sequence. Without the filter,
pressing Left three times silently adds three invisible characters to a password
you cannot see. The filter drops anything below `0x20`.

### A detour worth recording: control characters in source code

The constants above are defined as `String.fromCharCode(3)` rather than `""`
or a literal control byte, and that was not the first attempt.

Writing them as literal bytes worked, but the bytes were invisible in the file
and did not survive being edited through shell round-trips — several successive
attempts to patch them with `perl` and `sed` mangled them differently each time,
at one point silently replacing the *Enter* check with the *Ctrl-C* check, which
would have made the prompt unsubmittable. Writing them as `` escapes was
no better, because each layer (bash heredoc → node string literal → file) ate a
backslash.

`String.fromCharCode(3)` sidesteps the entire class of problem: it is plain
ASCII, it says exactly which byte is meant, and no shell, editor, or diff can
corrupt it. **When a value keeps getting mangled in transit, stop escaping it
better and change the representation so it does not need escaping.**

### Two bugs found by testing the failure paths

Smoke-testing the *guards* rather than the happy path found both.

**1. Dishonest exit code.** Running with an unknown email printed the right
message and then:

```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
exit=127
```

`process.exit()` tears down the event loop immediately. The Supabase client is
`fetch` underneath and still held open sockets, so libuv aborted. The message
printed, but the process died of the assertion rather than the exit code — a
caller checking `$?` sees 127 and cannot distinguish a bad email from a crash.

The fix: set `process.exitCode` and throw, letting the loop drain naturally.
Exit code is now 1, as intended.

**2. Ctrl-C would have crashed.** `fail()` throws, and it was being called from
inside the `stdin` `"data"` listener. **A throw inside an EventEmitter listener
does not propagate to the awaiting caller** — there is no `await` in that call
stack, so it becomes an uncaught exception rather than a clean abort. Pressing
Ctrl-C at the password prompt would have produced a stack trace and, worse, may
have left the terminal in raw mode.

The fix: reject the promise instead, so the abort reaches `main()`'s catch by
the same path as every other failure. The cleanup was also pulled into a
`restore()` helper called on *every* exit path, because raw mode is a global
change to the tty — leaving it on hands the user back a shell that no longer
echoes what they type.

### Guards on the script itself

- Resolves the email to a user **before** prompting — being told the account
  does not exist after typing a password twice is a poor trade.
- Confirms the target is in `public.teachers`, so a typo matching a student's
  synthetic address cannot silently overwrite a PIN.
- Requires 12 characters, not Supabase's project-wide 6. That floor exists
  because student PINs are 6 digits; it is far too low for an account that can
  read every student in every class.
- Asks twice, because there is no echo and therefore no way to see a typo — and
  the failure mode of a typo is delayed and severe: the update succeeds, the
  script reports success, and you find out at the next login.
- Refuses to run when stdin is not a tty, rather than falling back to echoing.
  A security guarantee with a convenience fallback is not a guarantee.

---

## The recurring theme

Every part of this session came back to the same idea: **the dangerous
operations are the ones that report success.**

- A `.gitkeep` deletion tells you immediately if it was wrong. A dead-code scan
  with a bad regex tells you nothing, and you delete `AuthProvider.tsx`.
- A failed row count that prints as blank looks like zero, and you delete on the
  strength of a number you never measured.
- `teacher_reset_pin()` returns cleanly and the student still cannot log in —
  which is why `CLAUDE.md` says to verify a PIN reset by actually signing in.
- `updateUserById` returns cleanly whether or not you typed the password you
  meant to.

So the same instruction applies to the password change as to everything else in
this codebase: **verify it by signing in, not by trusting the success message.**
