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

## Follow-up: the pre-fill didn't work, and why the first test missed it

Artem clicked the button for real: logged out, landed on `/login`, empty field.

### The actual cause: the router applies location changes as transitions

In React Router 7.18, `BrowserRouter` wraps every location update in
`React.startTransition`, which marks it low priority. The auth change from
`signOut()` is an ordinary, urgent state update. So after the click:

1. `signOut()` flips auth to "anon" (urgent).
2. `navigate("/login", { state: { nickname } })` writes the history entry
   straight away, but React's re-render for it is queued as a transition.
3. React renders the urgent update first, still believing it's on `/host`.
   `RequireHost` sees "anon" and renders `<Navigate to="/login" replace />`.
4. That `<Navigate>` runs `history.replace` and **overwrites** the entry that
   carried the nickname.

The `key` fix from earlier handled a different ordering, where our navigation
arrives *second*. Here it arrives first and gets erased, so there's nothing to
remount with.

### Why the first test passed

It pushed a history entry by hand and fired `popstate`. Nobody signed out, so
`RequireHost` never raced anything. The test checked the half of the flow that
worked and skipped the half that didn't. The lesson: **a test has to include the
thing that causes the bug.** Here that thing was signing out.

### The fix: take the router out of it

The nickname now goes in `sessionStorage` (`src/lib/previewLogin.ts`):

- The button stores `"Demo"`, then signs out, and **doesn't navigate at all**.
  `RequireHost`'s own redirect is what takes you to `/login`, so there's only
  one navigation and nothing to race.
- `StudentBox` reads the value in its `useState` initialiser and removes it in
  a mount effect. Reading and removing are separate steps because StrictMode
  runs initialisers twice in development. If the first call removed the value,
  the second call would get nothing, and React might keep that second result.
- `sessionStorage` is per tab, and the value is gone as soon as the form has
  read it, so a later visit to `/login` starts empty.
- The redirect's `from: /host` is ignored for this path, so a successful login
  goes to `/dashboard` instead of bouncing off `/host`.

Checked in the dev server (StrictMode on) by storing the value, then loading
`/host` while signed out, so the real guard redirect ran. Result: router state
held only `from`, the field read "Demo", the PIN field had focus, and storage
was empty afterwards. Reloading `/login` showed an empty field. The one piece
still untested here is the click itself, which needs the host password.
