# Technical log — 19 August 2026

## The host role

Sprig now has a third tier of access. A **host** is a teacher with `is_host = true`
who can read across every class in the pilot: all students, all completions, all
scores, every check-in mood and written answer, and the help-message inbox.
`teacher@example.invalid` is the one account that has it.

This is the first thing in the project that reads wider than "your own row", so
most of this log is about how that widening was contained and how it was proved.

Two migrations:

- `20260818010000_host_role.sql` — the column, the `is_host()` predicate, six read policies
- `20260818020000_host_tools.sql` — `may_act_on_student()`, the two widened actions, `host_help_messages()`

---

## 1. Why the new policies are *additional*, never edited

Every table already had a policy like this one, from July:

```sql
create policy "Teachers read their own students" on students
  for select to authenticated
  using ((select auth.uid()) = teacher_id);
```

The obvious way to let a host through is to edit it:

```sql
using ((select auth.uid()) = teacher_id or (select public.is_host()))   -- NOT what we did
```

That works. It is also the version where a mistake is expensive, because the
teacher rule and the host rule now live in one expression — get the host half
wrong and you have changed what *teachers* can see, and teachers are the rule
that is currently correct and load-bearing.

So instead a **second, separate policy** was added:

```sql
create policy "Hosts read all students" on students
  for select to authenticated
  using ((select public.is_host()));
```

The concept that makes this safe is that **PostgreSQL OR's together every
`SELECT` policy on a table**. A row is visible if *any* policy allows it. So:

- For a non-host, `is_host()` is `false`. The new policy contributes nothing to
  the OR, and the rows they see are exactly the rows the old policy allowed —
  not "almost the same", *the same*.
- For a host, the old policy contributes nothing (their `auth.uid()` is not any
  row's `teacher_id`), and the new one lets everything through.

The two rules never touch. The worst a bug in the new policy can do is break
the host's own dashboard.

Six tables got one each: `students`, `teachers`, `progress`, `test_attempts`,
`daily_checkins`, `weekly_checkins`. All `SELECT`. There is deliberately no host
`INSERT`, `UPDATE` or `DELETE` policy anywhere — broad *read* plus narrow,
audited *write* is a very different risk from broad write.

---

## 2. `security definer` here is load-bearing, not decoration

`is_host()` looks trivial:

```sql
create or replace function public.is_host()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t where t.id = auth.uid() and t.is_host
  )
$$;
```

The interesting word is `security definer`, and the reason is one specific
policy: the host needs to count teachers and schools, so there is a policy **on
`teachers`** whose predicate needs to read **`teachers`**.

Written inline, that is a loop. Postgres detects it and throws:

```
42P17: infinite recursion detected in policy for relation "teachers"
```

A `security definer` function runs as its **owner** (`postgres`) rather than as
the caller. A table's owner is not subject to that table's RLS, so the query
inside the function does not re-enter the policy, and the cycle is broken. This
only holds because no table in Sprig uses `ALTER TABLE ... FORCE ROW LEVEL
SECURITY`, which would subject the owner to RLS too — that was checked.

Two smaller details worth copying:

- **`set search_path = ''`** on every definer function, so an unqualified name
  can never be resolved to a table an attacker controls. That is why every
  single name inside is schema-qualified, including `auth.uid()` (which is
  already qualified — `auth` is the schema).
- **Called as `(select public.is_host())`**, not bare `public.is_host()`.
  Wrapping it in a sub-select lets the planner hoist it into an InitPlan and
  evaluate it **once per query** instead of once per row. This is the same
  reason every existing policy writes `(select auth.uid())`.

---

## 3. Grants and policies are two different gates

A recurring lesson in this schema, and it decided the shape of the inbox.

- A **GRANT** decides whether a role may touch the table *at all*. Checked
  first. Failing it gives `42501 permission denied for table X` — a hard error.
- A **POLICY** decides *which rows*. Failing it gives an empty result.

Every table that got a host policy already had `grant select ... to
authenticated`, so adding a policy changed only which rows — never whether a
previously unreachable table became reachable. That was the rule for this work:
**no new table-level grant to `authenticated`.**

`help_messages` is the one table with no grant at all, on purpose (August 17:
"Reads: nobody. Not students, not teachers."). Giving it a policy would have
required granting it to `authenticated` first — making it reachable by every
signed-in user in the project with a single policy in the way, and leaving the
grant sitting there for some future migration to widen by accident.

So the inbox is a function instead:

```sql
create or replace function public.host_help_messages()
returns table (id bigint, created_at timestamptz, message text, nickname text)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.created_at, h.message, s.nickname
    from public.help_messages h
    left join public.students s on s.id = h.student_id
   where public.is_host()
   order by h.created_at desc
$$;
```

The table stays structurally unreadable and this is the only door. `left join`
keeps anonymous messages visible, since `student_id` is nullable by design.

---

## 4. Widening an action without lying about its name

The reset-PIN and unlock tools had one guard, `teacher_owns_student()`. The
one-line way to let a host use them is to redefine it as `... or is_host()`.

That was rejected: the function would then return `true` for a student the
caller demonstrably does not own. A guard whose name contradicts its behaviour
is how a future reader reaches a wrong conclusion quickly and confidently — and
it would silently widen every future call site that reached for the
obvious-sounding name.

Ownership keeps meaning ownership. The widening got its own name:

```sql
create or replace function public.may_act_on_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.teacher_owns_student(p_student_id) or public.is_host() $$;
```

The audit trail gained a `via_host` column meaning "this was allowed **only**
because the caller is a host" — so a host resetting one of their own students
records `false`, like anybody else. The 40-actions-per-hour budget still applies
to a host, which is correct: a compromised host account should throttle exactly
like a compromised teacher account.

---

## 5. A React bug the host role exposed

This one is worth reading carefully, because it was not in the new code.

`AuthProvider` tracked whether profiles had loaded with a boolean:

```ts
const [profilesLoaded, setProfilesLoaded] = useState(false);
```

On a **cold page load** the sequence is:

1. First render: `userId` is null, because reading the session back out of
   localStorage is async. The effect takes its `!userId` branch and sets
   `profilesLoaded = true`. Reasonable — there are no profiles to wait for when
   nobody is signed in.
2. `getSession()` resolves. `session` and `userId` are set.
3. React renders. `sessionLoaded` is true, `userId` is set, and `profilesLoaded`
   is **still true from step 1**. So `status` computes to `"authed"` while
   `student` and `teacher` are both `null`.
4. Only *after* that render commits does the effect re-run and set it false.

Step 3 is a real, rendered frame where the app claims to be signed in and cannot
say as whom. Route guards read exactly that frame. `RequireHost` saw `role ===
null`, concluded "not a teacher", and redirected a genuine host away from `/host`
**on every refresh and every bookmark**. `RequireTeacher` had the identical hole
and had simply never been noticed, because its redirect lands somewhere
plausible.

The fix is to record *which user* the loaded profiles belong to, rather than
merely that some load finished:

```ts
const [profilesUserId, setProfilesUserId] = useState<string | null>(null);
const profilesCurrent = profilesLoaded && profilesUserId === userId;
```

In step 3 the stored id (null) no longer matches the current `userId`, so
`status` stays `"loading"`. No extra render, and it fixes both guards at once.

**The general lesson:** a boolean like `isLoaded` answers "did something
finish?" when the question you actually have is "is what I'm holding current for
what I'm looking at?" Whenever loaded state is keyed to an input that can
change, store the input, not a flag.

---

## 6. Two silent-wrong-answer bugs in the aggregation

Neither would have crashed. Both would have produced a confident, wrong number.

**Paging without an order.** PostgREST caps responses at 1000 rows and does it
silently. 18 students against 80 subtopics is already 277 progress rows; ninety
students would be thousands. So reads are paged with `.range()` — but a range
request with no `ORDER BY` asks for "rows 1000–1999" of a set whose order
Postgres never promised. Pages overlap and leave gaps. Every paged read now
orders by the table's primary key, which is unique and therefore a total order.

**Collapsing the cohort into one student.** `latestOutcomes()` (from July's
mastery work) reduces an attempt history to the most recent answer *per
question id*. That is exactly right for one student. Pour the whole cohort into
one call and two students who answered the same question collapse into one row —
the result would describe whichever student happened to be processed last. So
`topicDifficulty()` runs it **per student** and tallies the per-student maps
afterwards.

A third judgement call, in `cohortScores()`: comparing the mean baseline against
the mean Growth Check compares two *different populations*, because the students
who have sat a Growth Check are by definition the ones who stuck with it. The
page shows both means with their sample sizes, but the number labelled the
honest comparison is the **paired** one: mean of (latest growth − baseline)
across students who have both.

---

## 7. How this was verified

The important claim was never "the host can see everything" — that is easy to
eyeball. It was **"no non-host can see one row more than yesterday."** That needs
a before and an after.

`scripts/check-rls.ts` signs in as three real principals (a host, a non-host
teacher, a student) through the **publishable** key — not the service-role key,
which bypasses RLS and would report that everything is visible to everyone. It
records row counts *and* the actual nicknames visible (two runs can both say "2"
and mean different students), then diffs the non-host rows against a baseline
captured before the migrations ran.

Result, non-host teacher and student: **identical to the baseline**, byte for
byte. Host: 2 → 18 students, 0 → 277 progress rows, 0 → 13 test attempts.

Five invariants, each run against all three principals:

| Check | Result |
| --- | --- |
| Cannot set `is_host` on self | `42501 permission denied for table teachers` |
| Cannot write own teacher row at all | `42501` |
| Cannot insert a teacher row flagged host | `42501` |
| Cannot read `help_messages` directly | `42501` |
| Cannot reset a PIN in another class | refused, and the refusal is logged |

The self-promotion check is the one that matters most, and it is worth noting
how it *nearly* passed for the wrong reason. Before the migration it failed with
`PGRST204` — "no such column" — which proves nothing about permissions. A second
probe was added that writes to `school_name`, a column that has existed since
July, to isolate "there is no UPDATE grant" from "there is no such column". Post
migration both return `42501`.

Beyond the script:

- **The cross-class reset was verified by signing in with the new PIN**, per the
  standing rule from July: `teacher_reset_pin()` writes a bcrypt hash straight
  into `auth.users` and its failure mode is *silent* — the update succeeds and
  the student still cannot log in. The old PIN was also confirmed rejected, and
  `must_change_pin` confirmed back on.
- **In the browser**, a non-host teacher's session was used to hit PostgREST
  directly, bypassing the route guard entirely: 2 students, 1 teacher, **zero**
  progress/attempts/check-ins, `403` on `help_messages`, `is_host()` false. This
  is the point of the exercise — `RequireHost` is a courtesy, the policies are
  the boundary.

---

## 8. One consequence, and how it was resolved

Because policies are per-table and not per-page, the host's `/teacher` page
listed **all** students rather than their own class — the "Hosts read all
students" policy applies wherever `students` is read, regardless of which page
is doing the reading. Consistent rather than buggy, but it left "Your class"
sitting above a roster of the entire pilot.

Resolved by separating the two roles' surfaces entirely rather than by
filtering:

- The cross-links between `/teacher` and `/host` were removed.
- `RequireTeacher` now redirects a host to `/host`.
- A host lands on `/host` at login and cannot reach `/teacher` at all.

So `/teacher` has exactly one occupant again, the ordinary teacher it was built
for, and its copy is true for everyone who can reach it.

**Be precise about what that did and did not do.** It removed a *page*, not any
*access*. A host's six read policies still return every student, score and
check-in wherever those tables are read — that is the role working as designed,
and a host querying `students` directly with their own session would still get
all of them. Route guards are a routing convenience; the policies are the
boundary. Narrowing what a host can *read* would be a policy change, and this
was not one.

The other thing worth noting is that the two guards now redirect at each other
— `RequireHost` sends a non-host to `/teacher`, `RequireTeacher` sends a host to
`/host`. That is not a loop, because they test exact opposites of the same
boolean read off the same object: any account satisfies one condition and never
both. It would only cycle if the two could disagree about `is_host`.
