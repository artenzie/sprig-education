# Technical log — 13 September 2026

## What was built

A personal preview student, **Demo**, and a one-click way to reach its login
from the host dashboard.

1. **The account.** `create-students.ts --nickname "Demo" --teacher <host id>`.
   Like every student it starts on PIN `000000` with `must_change_pin = true`,
   so the first login goes through Set PIN.
2. **The progress.** 80 `progress` rows, one per subtopic across all four
   tiers, written by a throwaway script in the scratchpad (not the repo).
   Timestamps run in curriculum order from 17 Aug to 9 Sep 2026: 3–5 lessons
   on a study day, some days skipped, after-school times with jitter. Like
   the pilot account there are no `test_attempts`, so the mastery bars and growth chart stay
   honestly empty.
3. **The button.** `/host` now has "View as student (Demo)" beside "Log out".
   It signs out, then navigates to `/login` with `{ nickname: "Demo" }` in
   router state. The student form starts with that nickname and focuses the
   PIN field.

## Key concepts

### Seeding with the service-role key is not an RLS change

The seed script uses the service-role key, which *bypasses* row-level security
entirely. That is why it can write rows for a student who isn't signed in.
Bypassing a policy is not the same as changing one: no migration, policy or
function was touched. The same key is why these scripts can only ever run
locally.

### A bug caught while seeding: dates in the future

The first seed run ended on 23 September, ten days after "today". Nothing
errored, because the database has no idea what a plausible date is. The fix was
to pack more lessons into each study day, add a guard that refuses to write if
the last date isn't in the past, and replace only Demo's rows. The lesson:
generated data needs a sanity check on its *output*, not just a clean run.

### Router state vs. a query string

`navigate("/login", { state: { nickname } })` hands data to the next page
without putting it in the URL. React Router keeps it in `history.state`, and
the page reads it with `useLocation().state`. A `?nickname=Demo` query string
would also work, but it would sit in the address bar and browser history for
no benefit.

### The race, and why `key` fixes it

Signing out does two things almost at once:

- `RequireHost` sees `status === "anon"` and renders
  `<Navigate to="/login" />` with **no** nickname.
- Our handler, once `signOut()` resolves, navigates to `/login` **with** one.

If the guard wins, `Login` is already mounted and `StudentBox` has run
`useState("")`. When the second navigation arrives it's the same route, so
React keeps the component alive, and `useState`'s initial value is only read on
the *first* render. The field would stay blank.

Giving the component a `key` fixes it: `<StudentBox key={prefilledNickname} />`.
When a key changes, React throws the old instance away and mounts a fresh one,
so `useState(prefilledNickname)` runs again with the new value. This was checked
in the browser by mounting the page empty, then pushing a history entry
carrying the nickname: the field went from `""` to `"Demo"` and focus moved to
the PIN.

## What wasn't verified

- The full button click, because it needs a host sign-in whose password is
  typed only by Artem.
- Signing in as Demo, because the first login uses up the `000000` PIN change,
  and that PIN should be Artem's to choose.
