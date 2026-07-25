# Technical log — 25 July 2026

## Authentication: nickname + PIN, on Supabase's own auth

Today's session made a Sprig student into a real identity. Before this, `students` was a table nobody could read, `Login.tsx` was a beautiful form whose submit handler did literally nothing (`onSubmit={(e) => e.preventDefault()}`), and every number on the dashboard was typed in by hand. After it, a student can log in, is forced to replace their starter PIN, and — the part that actually matters — the database now knows who is asking when a request comes in.

That last point is the whole reason authentication came before persisting progress. You cannot write a rule like "a student may only read their own progress" until there is a trustworthy answer to "which student is this?".

---

## 1. The problem: Supabase wants an email, our students don't have one

Sprig students are anonymous by design. No real names, no email addresses, no photos. A student gets a nickname and a PIN from their teacher, and that pairing is the entire account.

Supabase Auth, meanwhile, is built around email + password.

There were two ways to resolve that:

**Option A — build our own login.** Store a hashed PIN in `students.pin`, compare it ourselves. This is what the original schema sketched out (the `pin text not null, -- hashed, never plain text` column). It sounds simple and it is a trap. You would have to choose a hashing algorithm and get its parameters right, write the comparison somewhere the browser can't tamper with it, invent your own session tokens, decide how those tokens expire and refresh, and — the killer — teach the database to trust them. Row-level security has no idea what a token you invented means. You would end up rebuilding `auth.uid()` badly.

**Option B — bend the nickname into the shape Supabase expects.** Keep every piece of real credential machinery, and change only the *label* on the door.

We took B. The nickname is turned into a synthetic email address the student never sees or types:

```
"Curious Squirrel"  ->  curious-squirrel@students.sprig.study
```

and the PIN is used as the password, verbatim. That's it. Everything downstream is stock Supabase: it bcrypt-hashes the PIN, issues a JWT, refreshes that JWT before it expires, persists the session to `localStorage`, and exposes the student's id to our SQL as `auth.uid()`. We wrote none of that, which means we can't get any of it subtly wrong.

The conversion lives in `src/lib/studentAuth.ts`:

```ts
export function nicknameToSlug(nickname: string): string {
  return nickname
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Two things worth noticing.

**Why slugify at all, rather than just sticking `@domain` on the end?** Because of who is typing. A 13-year-old copying "Curious Squirrel" off a slip of paper will type `curious squirrel`, or `Curious-Squirrel`, or leave a trailing space. Lowercasing and collapsing everything that isn't a letter or digit into a single `-` means all of those land on the same account. Case-insensitive login for free, from four lines of code.

**Why this file imports nothing.** `studentAuth.ts` has zero imports — deliberately. It's used by the login form *and* by `scripts/create-students.ts`, which runs in Node. If it imported `@/lib/supabase`, importing it from Node would drag in `import.meta.env`, which only exists inside Vite, and the script would crash. Keeping shared logic dependency-free is what lets it actually be shared.

And sharing it is not a nicety. If the script computed the address one way and the login form another, accounts would be created under one address and logged into under another. The symptom would be "my PIN doesn't work" — which tells you nothing at all about the real cause. One function, one source of truth.

### Why the domain is real

`students.sprig.study` is a domain the project owns. The tidier-looking choice would be a reserved TLD like `.invalid`, which is guaranteed by RFC never to resolve — no mail could possibly escape. But Supabase can apply extended email validation that rejects domains with no MX record, and *being rejected at account-creation time* is a far worse failure than a theoretical address. No mail is sent either way: email confirmations are off, and accounts are created already confirmed.

---

## 2. Six digits, not four — and why that wasn't our choice

The plan started with a 4-digit PIN. Supabase's minimum password length is **6**, and it is a single project-wide setting — the same number governs teacher passwords, which the login page advertises as "At least 8 characters."

So there were three ways forward:

| Approach | Cost |
|---|---|
| Lower the project minimum to 4 | Weakens teacher accounts too, and the hosted dashboard may refuse values below 6 |
| Keep 4 digits, secretly append a constant (`4827` -> `4827.sprig-pin`) | Works, changes nothing about security — but every admin script and every manual password reset must remember the suffix, or logins fail confusingly |
| **Use 6 digits** | Update some copy |

We used 6 digits. It needs no Supabase configuration change at all, introduces no magic constant, and is **100× harder to guess**: a million combinations instead of ten thousand.

That last number matters more than it looks, and section 4 explains why.

---

## 3. The keystone: `students.id` **is** `auth.users.id`

This is the single most important line of SQL in the whole session:

```sql
alter table students alter column id drop default;

alter table students
  add constraint students_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
```

`students.id` used to generate its own random uuid (`default gen_random_uuid()`). Now it must be supplied, and it must be the id of a real row in `auth.users`.

Think about what the alternative would have looked like. If a student had *two* ids — one in `auth.users`, a different one in `students` — then every single security rule would need a lookup: "given the auth user asking, find their student row, get that id, then compare." Every table. Every query. A join in every policy.

By making them the same value, `auth.uid()` — the id of whoever is making the request — can be compared **directly** against `students.id`, and directly against the `student_id` column on `progress`, `test_attempts`, `daily_checkins` and `weekly_checkins`. Those four tables already had `student_id uuid references students(id)` foreign keys, and they all kept working untouched. One line of SQL made four tables securable.

`on delete cascade` means deleting the auth user removes the student row and, through those same foreign keys, everything hanging off it — rather than leaving orphaned progress rows pointing at a student who no longer exists.

We also **dropped `students.pin`**. The PIN now lives in `auth.users.encrypted_password` and nowhere else. A second copy would be a liability rather than a feature.

### The visible consequence

`TopNav.tsx` used to have this:

```tsx
const pin = "4728";
// ...
{revealed ? pin : "••••"}
```

A little eye-toggle that revealed your PIN. It's gone, and **that is the intended outcome, not a regression.** bcrypt is a one-way function: you can check whether a guess matches, but you cannot get the original back. There is nothing to reveal — not to the student, not to us, not to someone who steals the entire database.

The price is real and worth stating: a forgotten PIN cannot be looked up. A teacher has to reset it. That is the correct trade for not storing children's credentials in a readable form.

---

## 4. Row-level security: the part that actually protects anything

Everything above was setup. This is the payoff.

Row-level security means the *database* decides which rows a request may see, based on who is making it. Not the React app — the database. That distinction matters because anything the React app decides can be undone by anyone willing to open developer tools.

### Two things are required, and missing either looks like a bug

```sql
grant select, insert, update on progress to authenticated;

create policy "Students read own progress" on progress
  for select to authenticated
  using ((select auth.uid()) = student_id);
```

**The GRANT** is checked first, before RLS is even considered. It answers "may this role touch this table at all?" Without it you get error `42501, permission denied for table progress` — a hard error, not an empty result.

**The POLICY** then answers "which rows?"

This project has already been bitten by exactly this. On 24 July, the content tables had read policies but no grant, and every anonymous request failed with a permission error that looked nothing like a missing grant. The comment in `20260724020000_grant_public_content_read.sql` records it. Today's migration does both for every table, on purpose.

### `using` vs `with check` — a genuinely subtle one

Look at the update policy:

```sql
create policy "Students update own progress" on progress
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);
```

Why both clauses, when they're identical?

- `using` decides **which existing rows you're allowed to target**.
- `with check` validates **the row you leave behind**.

With only `using`, a student could take a row they legitimately own and rewrite its `student_id` to a classmate's id — handing their row away, or planting data in someone else's account. `using` was satisfied (they owned it going in) and nothing checked what came out. Both clauses close that.

### Why `(select auth.uid())` and not `auth.uid()`

Both are correct. Wrapping the call in a subquery lets Postgres evaluate it **once per statement** instead of once per row. On a table with one row it's invisible; on a few thousand progress rows it isn't. It costs nothing to write it correctly from the start.

### What we deliberately did *not* grant

- **No `delete`, anywhere.** A student should be able to record and revise their own work, not erase their history. Nothing in the app needs delete, so it isn't granted.
- **No write access to `students` at all.** Not insert, not update. Accounts are created out of band with the service-role key, and the one column a student may change (`must_change_pin`) is changed by a function, not by a direct update.
- **`teachers` is untouched** — RLS on, zero policies, no grant, unreachable from any client. Teacher accounts are a separate design and were kept out of this session on purpose.

---

## 5. `SECURITY DEFINER`: letting a function do what the caller can't

Since students have no update permission on their own row, how does `must_change_pin` ever become `false`?

```sql
create or replace function public.complete_pin_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'complete_pin_change() requires a signed-in student';
  end if;

  update public.students
     set must_change_pin = false
   where id = auth.uid();
end;
$$;
```

**`security definer`** means the function runs with the privileges of *whoever created it*, not whoever calls it. That's what lets it perform an update the caller could never perform directly. It's the same idea as a bank teller: you can't reach into the vault, but you can ask someone who can, and they'll only do the one specific thing you're allowed to ask for.

**`set search_path = ''`** is the security hardening that has to come with it, and it's easy to skip without noticing. The `search_path` controls where an unqualified name like `students` gets looked up. Normally the *caller* controls that setting. So without this line, an attacker could point `search_path` at a schema of their own containing a fake `students` table, and our privileged function would happily update *that* instead — running as the owner, with full permissions. Setting it to empty means nothing resolves implicitly, which is why every name in the function is written out as `public.students`, `auth.uid()`, and so on.

(`pg_catalog` is the exception — it's always searched, which is why `now()` and `jsonb_build_object()` don't need qualifying.)

**Note the honest limitation.** Changing the password and clearing the flag are two separate calls from the browser. In principle a student could call `complete_pin_change()` on its own and skip the prompt. We accepted that: it requires a valid session, `students` has no update grant so this is the only route, and the worst possible outcome is a student choosing not to change *their own* PIN. Making it airtight would mean changing the password from inside Postgres with `crypt()`, which bypasses Supabase's auth entirely — a much bigger loss than the thing it fixes.

---

## 6. Brute-force protection, and being honest about its limits

A 6-digit PIN has a million combinations. A script can try a million of anything very quickly. So failed attempts need to cost something.

Supabase has a purpose-built feature for exactly this — the **Password Verification Attempt** auth hook, which GoTrue calls on every password check and which can reject the attempt. It is a **Teams/Enterprise** feature. Sprig is on the free plan. So we built it in Postgres:

```sql
create table if not exists login_attempts (
  nickname_slug  text primary key,
  failed_count   int not null default 0,
  locked_until   timestamptz,
  last_failed_at timestamptz not null default now()
);

alter table login_attempts enable row level security;
-- No policies. No grants. Reachable ONLY through the functions.
```

Three functions wrap it, and the login sequence in `AuthProvider.tsx` calls them in a specific order:

1. **Before** signing in — `login_lockout_status(nickname)`. If locked, stop *without touching the auth endpoint*.
2. Attempt the sign-in.
3. **After a failure** — `record_failed_login(nickname)`. Fifth failure closes a 15-minute lock.
4. **After a success** — `clear_login_attempts()`.

### Three design decisions in there worth understanding

**The table is keyed by nickname, not student id.** When a login fails we don't know who tried — the nickname might not even exist. So the key has to be the thing that was typed.

**Attempts against nicknames that don't exist are counted too.** This looks wasteful and is actually the point. If only *real* nicknames ever locked out, then the lockout itself would tell an attacker which nicknames are worth attacking. Same reasoning as the error message the app shows:

```
"That nickname and PIN don't match. 3 tries left."
```

Deliberately vague about *which* half was wrong. "No such nickname" would turn the login form into a tool for discovering nicknames — and a nickname is the only identifier a Sprig student has.

**`clear_login_attempts()` takes no argument.** It works out the nickname from `auth.uid()`. That means it needs a valid session, so it's only reachable *after* someone has proved they know the PIN, and it can only ever clear the caller's own counter. Had it accepted a nickname, anyone could have kept a counter pinned at zero and made the whole mechanism decorative. **Function signatures are part of your security model** — this one is safe because of what it *can't* be asked to do.

### What this does not protect against

Two gaps, both real, both worth knowing before a lesson goes wrong for reasons that look inexplicable.

**Someone can skip the counter entirely.** The publishable key ships in the JavaScript bundle — that's what it's for. Anyone can read it and call Supabase's token endpoint directly in a loop, never calling our functions at all. Supabase's own per-IP rate limit is the only backstop there. What our lockout genuinely stops is the realistic threat: a student at a classmate's laptop, working through likely PINs on the actual form.

**It cuts both ways.** `record_failed_login` has to be callable before anyone is signed in, so `anon` can call it — with *any* nickname. Someone who worked out the nickname format (the word lists are in `scripts/create-students.ts`, in this repo) could deliberately lock a whole class out, fifteen minutes at a time. That is the unavoidable cost of a lockout the client has to trigger: the same call that protects an account can be turned against it.

Both close the same way — route login through an Edge Function holding the service-role key, so the browser never talks to the auth endpoint and only the server can report a failure. That's the upgrade path, deliberately not built today.

**Also configure, in the Supabase dashboard**: raise the sign-in rate limit. The default is 30 attempts per hour *per IP*, and a whole class sits behind one school NAT. Thirty students logging in at the start of a lesson exhausts it, and the rest of the room sees failures that look exactly like a broken app.

---

## 7. The forced first-time PIN change

Every account is created with PIN `000000` and `must_change_pin = true`. Until it's changed, anyone who knows the convention can sign in as anyone.

The gate is `src/routes/RequireAuth.tsx`, used as a **layout route** — a route with no path of its own that wraps other routes and renders them through `<Outlet />`:

```tsx
<Route element={<RequireAuth allowPinChange />}>
  <Route path="/set-pin" element={<SetPin />} />
</Route>

<Route element={<RequireAuth />}>
  <Route path="/dashboard" element={<Dashboard />} />
  {/* ...everything else behind auth */}
</Route>
```

`/set-pin` sits behind the same gate but passes `allowPinChange` — because it's where the redirect *sends* people, and gating it identically would redirect to itself forever.

**`RequireAuth` is a convenience, not a security boundary.** Anyone can edit their way past a client-side redirect. The actual protection is section 4: without a valid session, the queries return nothing regardless of what the browser believes. This exists so a signed-out student sees a login form instead of an empty dashboard.

### One asymmetry in `SetPin.tsx` worth explaining

The forced flow does **not** ask for the current PIN. The voluntary flow (from the profile menu) does, and re-verifies it by signing in with it.

Why the difference? Because `supabase.auth.updateUser({ password })` **does not check the old password.** For the forced flow that's fine — they typed it seconds ago to get here. For a voluntary change it is not: without re-verification, an unattended logged-in laptop is all it takes to lock a classmate out of their own account.

---

## 8. Three React problems this ran into

### `onAuthStateChange` must not await

This one costs people entire afternoons:

```tsx
const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
  setSession(nextSession);
  setSessionLoaded(true);
});
```

supabase-js holds an **internal lock** while that callback runs. Awaiting another supabase call inside it deadlocks the client — the app just hangs, with no error anywhere explaining why. So the callback does nothing but drop the session into state, and loading the student row happens in a separate `useEffect`, outside the lock.

### `status` has three states, not two

```tsx
export type AuthStatus = "loading" | "authed" | "anon";
```

Reading a session back out of `localStorage` is asynchronous. On every page load there is a moment where we genuinely don't know whether anyone is signed in. Collapsing that moment into "signed out" would throw a logged-in student to `/login` on every single refresh. **"I don't know yet" is a real state and needs its own name.**

### The profile fetch is keyed on the user id, not the session

```tsx
useEffect(() => { /* fetch the students row */ }, [userId, loadStudent]);
```

The session object is replaced wholesale every time the token refreshes — roughly hourly. Keying the effect on the session would re-fetch the profile on every rotation, for no reason. Keying it on `session?.user.id` means it runs when the *person* changes.

Also, `main.tsx` uses `<StrictMode>`, which mounts every component twice in development to surface exactly this class of bug. That's why the effects unsubscribe in their cleanup and guard their async results with `let cancelled = false` — the same pattern already used in `Lesson.tsx` and `Topic.tsx`.

---

## 9. Creating accounts, and the key that must never reach the browser

`scripts/create-students.ts`, run by hand:

```bash
node --env-file=.env scripts/create-students.ts 30
node --env-file=.env scripts/create-students.ts 30 --dry-run
```

**Why a script and not a page in the app?** Creating a user requires Supabase's admin API, which requires the **service-role key**. That key bypasses row-level security *completely* — every policy in section 4 simply doesn't apply to it. With it in hand, any visitor could read and rewrite every student's data.

Which is why `.env.example` now reads:

```
# NEVER add a VITE_ prefix to these.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The `VITE_` prefix isn't decoration — it is the instruction that tells Vite to **inline a value into the JavaScript bundle**. `VITE_SUPABASE_PUBLISHABLE_KEY` is prefixed because it's designed to be public: on its own it can only do what the RLS policies allow. The service-role key must never be.

The other thing the script gets right is that a student is really **two rows that must agree** — one in `auth.users`, one in `public.students`, sharing an id. So if the second insert fails, it deletes the auth user it just made:

```ts
if (rowError) {
  await admin.auth.admin.deleteUser(user.user.id);
```

Without that rollback you'd accumulate auth users with no profile — students who can log in but have nowhere to land. (`RequireAuth` handles that state with an explanatory screen rather than a blank page, because "shouldn't happen" and "won't happen" are different things.)

Node 24 runs the `.ts` file directly — no build step, no ts-node. One consequence to know: `npm run build` does **not** typecheck it, because `tsconfig.app.json` only includes `src`.

---

## 10. What was verified, and what wasn't

Verified:

- `npm run build` (TypeScript + Vite) — clean.
- `npm run lint` (oxlint) — clean. This is why `AuthContext.tsx` got split into `auth.ts` (context, hook, types) and `AuthProvider.tsx` (the component): a module exporting both a component and other values breaks React Fast Refresh, and oxlint says so.
- All three migrations parsed against **Postgres's real grammar** (via `libpg-query`) — 5, 34 and 19 statements, no syntax errors. Note this validates the *outer* SQL only; plpgsql function bodies are parsed by Postgres at `create function` time, so those were checked by hand instead (every identifier inside a `search_path = ''` function is either schema-qualified or in `pg_catalog`).
- In a real browser: `/dashboard` while signed out redirects to `/login`; the PIN field reads "6-digit code"; the nav shows "Log in" rather than an avatar; submitting the form runs the whole client sequence and renders the error state correctly.

At the time that list was written, **nothing had been verified end to end** — no migration had been applied, so no account existed and nobody had logged in. That has since changed, and section 11 records what actually happened when the database came online.

---

## 11. Applying it for real — and the two things that broke

Everything above was written before a single migration had been applied. This section is what happened when they were, because two of the failures are more instructive than anything that worked first time.

### The bug that proved section 4's own lesson

The seeding script failed on its very first query:

```
Could not read existing students: permission denied for table students
```

While holding the **service-role key** — the key whose entire selling point is that it bypasses row-level security. That looks impossible.

It isn't, and it is exactly the lesson section 4 already spells out, one layer further down. Two separate checks run on every query:

1. **Does this role hold a table-level `GRANT`?** — checked *first*, for *every* role.
2. **Which rows do the RLS policies allow?** — this is the one `service_role` skips.

`service_role` was never failing step 2. It was failing step 1. The RLS migration had granted access to `authenticated` and to nobody else. Supabase normally has default privileges that grant new `public` tables to all three roles automatically, but this project's tables were created before that was in place — which is precisely why the content tables needed an explicit grant back on 24 July, and why this one needed `20260725030000_service_role_grants.sql`.

**The lesson worth keeping:** "bypasses RLS" and "is allowed to touch the table" are different sentences. Knowing the rule in the abstract did not stop it happening — the grant was written for the role that was top of mind, and the admin script was an afterthought.

### The crash that hid the error

Once fixed, the script died with:

```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

A native libuv crash, on Windows, burying the actual message under a C stack trace. The cause: `process.exit(1)` inside the error path while supabase-js still had open sockets. `process.exit` tears the process down immediately rather than letting the event loop drain, and libuv asserts on the half-closed handles.

The fix is a good general habit — **don't call `process.exit` to report an error.** Throw, and let a top-level handler set the exit code:

```ts
class ScriptError extends Error {}
function fail(message: string): never { throw new ScriptError(message); }

try {
  await main();
} catch (error) {
  // Expected failures get a clean message; anything else keeps its stack.
  console.error(error instanceof ScriptError ? error.message : error);
  process.exitCode = 1;   // not process.exit()
}
```

`process.exitCode` sets the value the process will *eventually* exit with, letting Node shut down cleanly on its own.

### The end-to-end pass

Three accounts were seeded, and the whole flow was exercised in a real browser.

**Guards and the forced PIN change.** `/dashboard` while signed out redirected to `/login`. Signing in on `000000` landed on `/set-pin`, and typing `/dashboard` manually bounced straight back. All three client-side PIN rules fired with their own messages: the starter PIN, a straight run (`123456`), and a mismatch between the two fields. A real PIN landed on the dashboard.

The single most informative check was the one after that: **a full page reload stayed signed in and did not re-prompt for a PIN.** That one action proves two things at once — supabase-js rehydrated the session from `localStorage`, *and* `complete_pin_change()` genuinely wrote `must_change_pin = false` to the database rather than only flipping it in React state. A reload is the cheapest way to tell real persistence from a component that merely looks right.

**Login edge cases.** The old PIN was refused. `GENTLE-WREN` — uppercase, hyphen where the space was — signed in successfully, confirming the slug mapping from section 1 collapses all those spellings onto one account.

**The lockout.** Five failures locked the account, and the sixth attempt **with the correct PIN was still refused** — which is the property that actually matters, since a lockout that yields to the right answer isn't a lockout. A nickname that does not exist produced *identical* wording and accumulated attempts identically; that is the anti-enumeration behaviour from section 6 working as intended. A successful login reset the counter to five.

**RLS, and why the error messages matter more than the failures.** Signed in as one student, writes aimed at another student's `student_id` were attempted against all four tables. Every one failed — but *how* they failed is the real result:

| Attempt | Error | What it proves |
|---|---|---|
| Insert with another student's `student_id` | `new row violates row-level security policy` | The **policy** rejected it — which means the `GRANT` exists |
| `delete` own progress | `permission denied for table progress` | No `DELETE` grant at all, by design |
| `update` own `students` row | `permission denied for table students` | No `UPDATE` grant, by design |

Both are `42501`, and telling them apart is the whole skill. *"Violates row-level security policy"* means the grant is present and the policy did its job. *"Permission denied for table"* means the query never reached the policy. Had the cross-student insert returned `permission denied`, it would have looked like a pass while actually proving nothing — the write would have been stopped by a missing grant, leaving the policy itself untested. **A test that passes for the wrong reason is worse than one that fails.**

Reads behaved too: `students` returned exactly one row, `progress` returned zero rows with no error (grant present, policy filtering), and `login_attempts` was `permission denied` — unreachable from the browser exactly as section 6 intended.

### A limitation found by tripping over it

Trying to inspect `login_attempts` with the service-role key returned `permission denied` — because `20260725030000` deliberately withholds that grant. Correct behaviour, and it surfaced something the design had not thought through:

**Nothing can currently lift a lockout early.** The service-role key has no grant on the table, and `clear_login_attempts()` derives its slug from `auth.uid()`, so it needs the student's own session — which is exactly what a locked-out student cannot obtain. The only remedies are waiting fifteen minutes or running SQL in the dashboard.

The lockout message originally ended *"or ask your teacher"*, which promised help that no teacher tool can deliver. It now just states the wait. That is worth noticing as a habit: **interface copy makes promises, and a promise the system can't keep is a bug even though no code is wrong.** Restore the sentence when teacher tooling can actually clear a lock.

### One smaller thing

The hand-out CSV wrote the PIN as bare `000000`. Excel type-infers every CSV field and would print `0` beside every student's name — and quoting doesn't help, because Excel strips the quotes before inferring. The file now writes `="000000"`, Excel's escape hatch for "this is text, leave it alone", which Google Sheets and LibreOffice honour too.

### What is still unverified

The lock was confirmed to *engage* and to refuse a correct PIN, but nobody waited out the full fifteen minutes to watch it expire and hand back a fresh set of tries. That branch is reasoned from the migration, not observed. Saying so is the point — the honest boundary of a test is part of its result.

---

## 12. Real progress — and deciding what a database should actually store

With auth done, the mock data could finally become real: `Dashboard.tsx`'s hardcoded `width: "13%"`, the 24 hand-set node states in `JourneyTree.tsx`, `Topic.tsx`'s `const completed = 0`, and the seven invented weekly scores in `Progress.tsx`. All of them had been waiting on a trustworthy answer to "which student is asking?"

Three things about this turned out to be more interesting than the wiring.

### Store facts, derive opinions

`progress.status` allows three values — `locked`, `available`, `complete`. The obvious reading is that you write all three: seed every student with 20 `locked` rows at sign-up, flip one to `available` when it unlocks, then to `complete` when they finish.

We write **only `complete`**. A row means "this student finished this subtopic". Absence means they haven't. Locked-versus-available is worked out on the client, every render, in `src/lib/journey.ts`.

The reasoning generalises well beyond this project:

- **Two sources of truth eventually disagree.** If lock state is stored, a row can say `locked` for a subtopic the student demonstrably finished. That is a bug that has to be found, explained and repaired. If lock state is *derived*, that bug cannot be represented — there is no field in which to be wrong.
- **Stored rules need backfills; derived rules don't.** Changing the unlock rule (say, letting any subtopic in a started topic be attempted) is a one-line edit to a pure function. Had lock states been rows, the same change means a migration rewriting every student's data.
- **Completion is a fact about the past; lock state is an opinion about the present.** Facts don't change. Opinions change whenever the rules do. Storing the fact and computing the opinion means the database only holds things that stay true.

The cost, stated honestly rather than hidden: two of the three enum values are now dead. That is a real wart, and the alternative was worse.

### The bug that would have looked like a data problem

`deriveJourney()` contains this guard, and it is the most important line in the file:

```ts
const isComplete = hasContent && completedCount === subtopics.length;
```

Without `hasContent`, consider a topic in Tier 3 with no subtopics authored yet. `completedCount` is 0. `subtopics.length` is 0. And `0 === 0` is **true** — so the topic reports complete.

Only Tier 1 has content, so 15 empty topics would all report complete, the entire canopy would light up green, and the dashboard would read 100%. Worse, it would look like bad data — you'd go hunting in Postgres for rows that were never there, when the fault is a JavaScript expression that is vacuously true over an empty set.

The general shape: **"every element satisfies P" is always true when there are no elements.** Any `.every()`, or any `count === total` check, silently claims success on emptiness. Whenever the answer "all of them" would be surprising for an empty collection, the emptiness needs its own explicit test.

### Where the write happens, and why it's idempotent

One line records everything, in `Lesson.tsx`, fired when a subtopic's last question is answered:

```ts
if (step.questionIndex !== step.totalQuestions - 1) return;
```

Identifying the last question *positionally* rather than by comparing against the following step is what lets one trigger serve both flows — the deep-linked single subtopic (`buildSubtopicSteps`) and the whole topic walked end to end (`buildSteps`). A student who does two of four subtopics gets credit for exactly two, with no special-casing.

The write itself:

```ts
{ onConflict: "student_id,subtopic_id", ignoreDuplicates: true }
```

`ignoreDuplicates` compiles to Postgres's `ON CONFLICT DO NOTHING`. Redoing a lesson to revise therefore leaves the original `completed_at` alone instead of moving it to today — which matters the moment anything reads those dates, since a streak that rewrites its own history every time a student revisits an old lesson is not a streak. It also means only the INSERT policy is ever exercised, never UPDATE.

It is deliberately not `await`ed. Advancing a lesson should never wait on a round trip; if the write fails, the student keeps moving and sees a quiet notice on the completion screen. Silence there would be the wrong call — they would return to the tree, find the lesson still unfinished, and have no way to know why.

### Completion does not mean correctness

Finishing a subtopic records a completion regardless of how many answers were right, because `FeedbackStep` has always let you continue after a wrong one. During verification several questions were answered wrongly on purpose and the completion still recorded — which is the intended behaviour, not a leak. A completion means "worked through it". Scoring is what `test_attempts` is for.

### Saying "I can't show you this yet"

`Progress.tsx` was the hard one. Its mock data was almost entirely *test scores*, not lesson completion: seven Growth Check results, five per-topic "mastery" percentages, five missed questions with written explanations.

None of it is recoverable from `progress`, and that is a modelling limit rather than a missing query. `progress` records **that** a subtopic was finished — one row, no score. It cannot know how many questions were right, which were missed, or when a test happened. Those belong to `test_attempts`, and nothing writes there because Progress and Growth Checks don't exist.

The tempting move was to relabel completion as "mastery" and let the bars stay full. The page would have looked finished. It would also have been showing a number that does not mean what its label says — and the person most misled would be the student reading "82% mastery" after answering nothing.

So the page now shows real completion (labelled *complete*, not *mastery*) and honest empty states for the rest, saying what will appear and what has to happen first. **An empty state that explains itself is a feature; a full-looking chart built on nothing is a lie with good typography.**

The finished chart and card components were not deleted. They are parked, intact and exported, in `src/components/sprig/growth-check-parked.tsx`. That is what `export` is good for here: `noUnusedLocals` fails the build on an unexported function nobody calls, so exporting is the mechanism that lets completed-but-unwired work sit in the repo without being deleted or breaking compilation. Git history would have preserved it too — but only for someone who knew to go looking.

### Verified against the real database

Signed in with zero progress: the tree drew `I.I` as the current node — it had been hardcoded to `I.IV` — with the other 23 nodes disabled, and `0 / 20` at 0%.

Completing one subtopic through the real UI produced exactly one row. `Topic` then read `1 OF 4 COMPLETE`, subtopic 2 became *Start here*, 3 and 4 stayed locked; the dashboard moved to 5%. Redoing the same lesson left the row count at one and `completed_at` unchanged — idempotency confirmed rather than assumed.

The check worth copying: a second student was signed in and saw `0 / 20`. The progress query carries **no `student_id` filter at all** — it relies entirely on the RLS policy from section 4. Watching a different student see nothing is what turns that reliance from a claim into a demonstrated fact.

---

## What this unblocks

Lesson progress is real. What is still fabricated, or simply missing, is everything to do with *assessment*: Progress Checks, Growth Checks, `test_attempts`, and the per-question answer history that both the growth chart and the missed-question cards need. Streak and XP were removed rather than faked in this pass — `daily_checkins` has no writer, and XP has no rule defining what a subtopic is worth.

That is the next piece of work, and it now has a clear shape: a test flow that writes `test_attempts`, and a decision about whether individual answers are stored alongside it. The UI for the results is already built and waiting.
