# Technical log — 11 August 2026

## What we did today

Tier 4's content is Python, and Python is whitespace-significant — a `def`
whose body isn't indented four spaces isn't slightly wrong, it's a syntax
error to anyone reading it as code. `slides.body` was never built for that:
it's plain text, rendered through a single flat `<p>{slide.body}</p>`, and
HTML collapses runs of whitespace inside a `<p>` by default. A four-space
indent and a one-space indent render identically. Today added a `slide_type`
column and a renderer branch so a slide can opt into being shown as code —
additive only, so nothing about Tiers 1–3 changes.

---

## 1. Why this needed a column, not just a CSS class

The renderer can't guess whether a slide's body is code from the text alone
— "class Foo:" could be code or could be a slide talking about a class
called Foo. That decision has to be made once, by whoever writes the slide,
and stored. Hence `slide_type text not null default 'text' check (slide_type
in ('text', 'code'))` in
`supabase/migrations/20260811000000_add_slide_type.sql`. The default matters
more than it looks: every slide written for Tiers 1–3 already exists as a
row with no `slide_type` value, and `default 'text'` means the migration
itself is what keeps them rendering exactly as before — no backfill script,
no follow-up UPDATE, no risk of an existing slide silently losing its
paragraph rendering.

## 2. The renderer branch, and why the whitespace CSS alone isn't the whole story

In `src/pages/Lesson.tsx`'s `SlideStep`:

```tsx
{slide.slide_type === "code" ? (
  <pre className="overflow-x-auto rounded-lg border border-border bg-foreground/[0.04] p-4 text-[14px] leading-[1.6]">
    <code className="whitespace-pre font-mono">{slide.body}</code>
  </pre>
) : (
  <p>{slide.body}</p>
)}
```

`white-space: pre` is necessary but not sufficient on its own — it tells the
browser not to collapse whitespace when it paints text, but it says nothing
about whether the text handed to it was already mangled somewhere between
the database and the DOM (Postgres, PostgREST's JSON encoding, or React's
own handling of a text child). Those are three separate places a newline or
a run of spaces could theoretically get lost, and CSS only controls the
last step. So today's verification (section 4) checked the string at each
boundary rather than assuming the CSS made the rest automatic.

`overflow-x-auto` on the `<pre>` (not the `<code>`) means a long unbroken
line scrolls horizontally inside its own box instead of forcing the whole
lesson page wider — the same containment pattern already used for the
video frame elsewhere in this file.

## 3. A blocked action, and why that was the right call

The plan was to verify by inserting a scratch slide and checking it in a
real, logged-in lesson view — the same standard this project has held to
all along (`TECHNICAL_LOG_Aug8.md`, `TECHNICAL_LOG_Aug9.md`: a migration
that runs without error only proves syntax, not behavior). That needs a
real student session, which needs a real student account, which needs
`scripts/create-students.ts` — and the first attempt to run that script was
refused by the harness's own permission classifier, because creating an
auth account is a sensitive action by default.

That refusal was correct to respect rather than route around. The fix
wasn't a workaround — it was asking directly, in chat, and the user
explicitly authorized running the seeding script for one scratch account.
Same script this project has used all along to create real student
accounts; the only thing that changed was getting the human sign-off the
action actually needed before a service-role key touched `auth.users`.

## 4. Verifying whitespace at each real boundary, not just "it doesn't error"

**Database round-trip**, via a scratch script (service-role key, deleted
after): inserted a slide with `slide_type: "code"` and a Python body with
both 4-space and 8-space indentation, read it straight back, and compared
byte-for-byte. The round trip matched exactly, and an untouched
pre-existing slide read back `slide_type: "text"` — proof the migration's
default actually applied to old rows, not just new ones.

**Real browser render**, signed in as a genuine throwaway student
("Watchful Dormouse," created via `create-students.ts` with the
authorization above, through the actual nickname/PIN login and forced
first-PIN-change flow — not a service-role bypass). The scratch slide was
inserted as the first slide of a real subtopic so the normal lesson flow
would reach it naturally. It rendered with the `if`/`else` bodies visibly
at two visually-distinct indent depths — not collapsed to one level, which
is exactly what the old `<p>` would have done.

Rather than trust the screenshot alone, a follow-up script read the actual
DOM in that same tab: the rendered `<code>` element's `textContent` was
compared against the exact source string, and its computed styles were
read directly rather than assumed from the class names. Both matched —
`textContent` equal to the original string, `white-space: pre`, a
monospace font stack, and `overflow-x: auto` on the surrounding `<pre>`.
That closes the loop the plan named at the start: not just "it doesn't
crash," but the exact string that went into the database is the exact
string sitting in the DOM, with the CSS that keeps it displayed that way.

**Cleanup.** Scratch slide deleted, scratch student's `students` row and
`auth.users` entry both deleted, scratch scripts and the auto-generated
CSV hand-out removed — none of it committed. Confirmed by `git status`
showing only the two real files (the migration and `Lesson.tsx`) before
committing.

## 5. A Windows file lock, not a git problem

The first fast-forward attempt (`git checkout main`) failed to unlink the
new migration file mid-checkout — "Device or resource busy" — because some
other program on the machine had it open (visible as a `~$...`
Office-style lock file sitting next to it, itself never tracked or touched
by git). This briefly left `main`'s working tree holding an untracked copy
of a file that also existed, correctly, inside the feature branch's
commit — not a corruption, just two copies of identical content confusing
`merge --ff-only`. Diffing the branch's committed version against what was
on disk confirmed nothing had actually been lost; the fix was closing the
other program's hold on the file, removing the stray untracked copy, and
re-running the same fast-forward, which then succeeded cleanly.

The general lesson: a git error mid-checkout that names the filesystem
rather than git's own object model ("unable to unlink," "Device or
resource busy") is worth reading literally rather than reflexively
reaching for a forceful fix — it is very often something external holding
the file open, not damaged git state.

---

## What was verified

| Check | Result |
|---|---|
| Existing slides (Tiers 1–3) default to slide_type = "text" after the migration, with no backfill step | done, confirmed by reading back an untouched slide |
| npx tsc -b across the whole project | clean |
| Database round-trip of a code slide's body preserves whitespace exactly, byte-for-byte | done |
| Real logged-in lesson view: DOM textContent for a code slide matches the source string exactly | done |
| white-space: pre, monospace font, and horizontal scroll (overflow-x: auto) actually applied, read from computed styles, not assumed from the class names | done |
| Text-type slides render unchanged (same &lt;p&gt; path, untouched) | done |
| Scratch student account, scratch slide, scratch scripts, and generated CSV all fully removed afterward, confirmed by git status / re-query before committing | done |
| Migration applied to the real Supabase project, by the user, in the SQL Editor (this project's established workflow — no CLI, no direct DB connection from this tool) | done |
| Pushed straight to main via fast-forward, matching this project's whole history | done, 387fecd..2e135a0 |

---

# Part two — customizable leaf avatars

## What we did

Students previously had exactly one way to be represented visually in the
app: two letters in a circle, derived from their nickname. Today added a
second option — a small curated set of botanical line-art leaf icons a
student can pick from the profile dropdown, replacing an inert "Customize"
button that had never done anything. Picking a leaf writes it to the
student's own row and it now shows up everywhere the initials circle used
to.

## 6. Why this needed a security-definer function, not just an UPDATE call

`students` has never had an `update` grant for the `authenticated` role —
only `select` (see `20260725010000_student_rls_policies.sql`). That wasn't
an oversight to work around; it's the whole point of the table's design.
The one existing exception, clearing `must_change_pin` after a PIN change,
goes through `complete_pin_change()`, a `security definer` function that
runs with the privileges of whoever owns it rather than the caller — which
is the only way a browser-side client, holding nothing but a signed JWT,
can ever legally change a row it can't directly write to.

`set_avatar_leaf(leaf text)`, in
`supabase/migrations/20260811010000_add_avatar_leaf.sql`, is built the same
way on purpose: `auth.uid()` identifies the caller from their JWT (which
they cannot forge), `set search_path = ''` stops the function body from
silently resolving `students` to some other schema a caller might control,
and the update is scoped to `where id = auth.uid()` so a student can only
ever touch their own row. The allowed leaf ids are checked twice — once by
a table-level `check` constraint (so nothing bad can land in the column
even from outside the app), and once inside the function itself, so a bad
id fails with a readable error message instead of a raw Postgres
constraint-violation reaching the client.

## 7. Null as a real state, not a missing one

`avatar_leaf` is nullable with no default. That's a deliberate three-state
design, not two: a student is either "hasn't picked a leaf yet" (null,
shown as the initials circle), or "picked leaf X" (shown as that leaf).
There's no third "no avatar" state to design for, and no migration needed
to backfill existing students — every row that already exists reads as
null automatically, which is exactly "still on the initials fallback." The
fallback check in `TopNav.tsx` is a plain `isLeafAvatarId(student.avatar_leaf)
? <LeafAvatar .../> : nicknameInitials(...)` — the null case falls straight
through to code that already existed and was already correct.

## 8. Drawing eight leaves that all agree on a style

`src/components/sprig/leafAvatars.tsx` is a new file, not an addition to
`JourneyTree.tsx`, even though the tree already had a `Leaf()` component —
that existing one is a private, unexported piece parameterized for
scattering leaves around a canopy (position, rotation, grown/ungrown
color), not something a picker grid could reuse directly. What did carry
over was the *drawing convention*: a filled blade path under a slightly
heavier stroke, with a thin center vein — `Leaf()`'s exact recipe, applied
to eight new silhouettes instead of one. Each of the eight is a fixed
shape-and-color pair (a maple-ish blade in forest green, a lobed oak shape
in mint, a fan-shaped ginkgo in terracotta, and so on) rather than a
shape-picker crossed with a separate color-picker — simpler to build and
closer to what "pick one of these leaves" actually means to a 13-year-old
than a two-step customizer would be. All four colors came straight from
existing CSS custom properties (`var(--forest)`, `var(--mint)`,
`var(--terracotta)`, `var(--gold)`) — no new design tokens, same palette
the rest of the app already uses.

## 9. One field, two render sites, no extra plumbing

`Student.avatar_leaf` was added in exactly two places:
`src/context/auth.ts` (the type) and `AuthProvider.tsx`'s `STUDENT_COLUMNS`
string (what actually gets selected from the database). Everything after
that follows for free, because both places in `TopNav.tsx` that show a
student's identity — the small trigger button and the larger panel avatar
— already read from the same `useAuth()` hook. Picking a leaf calls
`supabase.rpc("set_avatar_leaf", { leaf: id })` and then the existing
`refreshStudent()` (the same re-fetch `AuthProvider` already exposed for
other flows) — no new state, no manual sync between the two render sites,
because they were never two separate pieces of state to begin with, just
two places rendering the same one.

## 10. A scope question worth asking instead of assuming

The original ask included "teacher roster if easy." Reading
`TeacherStudents.tsx` first showed it renders no avatar or initials
anywhere — and its own code comment explains that was a deliberate,
previous decision to keep that page from being "student-shaped." Adding a
leaf there would have been new UI, not a swap of an existing element, which
is a different-sized change than what "if easy" implied. Rather than guess
either way, that got asked directly before writing any code; the answer was
to keep this session scoped to TopNav only, leaving the roster page
exactly as it was designed.

## 11. Verifying the fallback, not just the happy path

A migration that applies without error only proves the SQL parsed —
established standard on this project (see part one, and
`TECHNICAL_LOG_Aug8/9.md`). Verification here needed two different real
students, not one: an existing account with a login already on record, and
a brand-new throwaway seeded via `create-students.ts` (authorized in chat,
same as every other time this session has needed one).

On the existing student: opened the profile dropdown, picked a leaf,
watched both render sites update immediately, then reloaded the page from
a cold navigation and confirmed the leaf was still there — proof it came
from the database round trip through `refreshStudent()`, not from
component state that would have reset on reload. On the brand-new student,
who has never called `set_avatar_leaf`, the dropdown correctly showed the
initials fallback with none of the eight grid options marked as selected —
the null path, exercised for real rather than just read in the code.

**Cleanup.** The scratch student's `auth.users` entry and `students` row
were deleted via a one-off script (service-role key, deleted immediately
after running), along with the generated PIN hand-out CSV. `git status`
showed only the real feature files — the migration, the new
`leafAvatars.tsx`, and the three edited files — before committing.

---

## What was verified (part two)

| Check | Result |
|---|---|
| `npx tsc -b`, `npm run build`, `npm run lint` across the whole project | clean (one pre-existing, unrelated lint warning in `TestFlow.tsx`) |
| A student with no `avatar_leaf` set sees the initials-circle fallback, in both TopNav render sites | done, verified with a freshly seeded student |
| Picking a leaf updates the nav-trigger avatar and the profile-panel avatar together, with no manual refresh | done |
| The choice survives a full page reload (not just component state) | done |
| `set_avatar_leaf()` rejects an unrecognized leaf id with a readable error, and the table `check` constraint backs it up independently | done, read from the migration logic (not separately fault-injected) |
| Scratch student account and generated CSV fully removed afterward, confirmed by `git status` before committing | done |
| Migration applied to the real Supabase project, by the user, in the SQL Editor | done |
