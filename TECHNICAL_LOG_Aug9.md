# Technical log — 9 August 2026

## What we did today

Built the first version of class-wide visibility for teachers: `/teacher`
now shows each student's tier and completion count next to the existing
Unlock/Reset PIN tools, plus a class-wide chart of how far the class has
gotten through each topic. This is the piece `20260727000000_teacher_accounts.sql`
deliberately left undone back on 27 July, with a comment saying so: "Showing
a teacher their class's progress is a separate piece of work, and it needs
its own thinking about what the teacher of a deliberately anonymous student
ought to be able to see." Today's session is that thinking, kept
deliberately narrow — completions only, never a score, never an answer.

---

## 1. The gap was in the database, not the UI

Before writing a single component, the actual question was: **can a
teacher's session even read `progress` right now?** Not "does a query
exist" — whether Postgres would let one succeed at all. Reading
`20260725010000_student_rls_policies.sql` and `20260727000000_teacher_accounts.sql`
directly (rather than assuming) confirmed it plainly: `progress` has exactly
one SELECT policy, `auth.uid() = student_id`, and nothing else. A teacher's
`auth.uid()` is never any row's `student_id`, so that policy matches zero
rows for them — not an error, just silently nothing. `grant select ... to
authenticated` already exists on the table, so this isn't a missing grant
(which would 42501); it's a missing *policy*, which just makes the table
read as permanently empty for a teacher session.

The fix is a second SELECT policy, the same shape as the one that already
lets a teacher read `students`:

```sql
create policy "Teachers read their students' progress" on progress
  for select to authenticated
  using (
    exists (
      select 1 from students s
      where s.id = progress.student_id
        and s.teacher_id = (select auth.uid())
    )
  );
```

**Why this doesn't need a `with check` or touch INSERT/UPDATE at all:**
Postgres policies are per-command. This is a `for select` policy — it only
ever governs what a `select` can return. The existing `insert`/`update`
policies on `progress` are untouched and still say `auth.uid() = student_id`,
so a teacher session still cannot write a single row here. Read access and
write access are two entirely separate grants of trust, and widening one
says nothing about the other.

**Why multiple policies on the same table are additive, not a replacement.**
Postgres OR's every policy that applies to a given command together. So this
new policy sits *alongside* "Students read own progress" rather than instead
of it — a student's session still only ever matches the first one (their own
`student_id`), because a student's `auth.uid()` can never equal any row's
`teacher_id`. Nothing already granted gets narrower; something new becomes
visible only to the role the new policy actually describes.

**The general lesson:** "is this reachable from the browser at all" is a
database question with a yes/no answer you can check by reading the RLS
policies directly, before writing any client code — not an assumption to
carry forward from what a comment in an old migration says is still true.
Here the comment happened to still be accurate (nice), but the way to know
that was to open the file, not to remember it.

---

## 2. Reusing `deriveJourney()` instead of inventing a second progress model

`src/lib/journey.ts` already turns "curriculum plus a set of completed
subtopic ids" into a full `Journey` — percent complete, which topic is
current, how many subtopics are done out of how many exist. That function
takes no student-specific inputs beyond the completed-ids set; it's pure.
Which means it doesn't care *whose* completions it's given.

So building "what does student X's progress look like, from a teacher's
point of view" didn't need new logic — it needed the *same* function, called
once per student:

```ts
for (const student of students) {
  journeyByStudentId.set(
    student.id,
    deriveJourney(topics, progressByStudentId.get(student.id) ?? new Set()),
  );
}
```

This matters beyond "less code to write." If tier-unlock rules ever change —
say, a topic needs 80% of its subtopics rather than 100% — there would be
exactly one function to update, and both the student's own dashboard and
the teacher's roster would pick up the change automatically, because they
run through the identical code path. Two independent re-implementations of
"what counts as this topic being done" is exactly the kind of thing that
quietly drifts apart over a few months — one gets patched, the other
doesn't, and nobody notices until the numbers disagree.

**The general lesson:** a pure function with no notion of "whose data this
is" is inherently reusable across "one record" and "many records" — the
caller decides how many times to call it and what to do with the results.
Building the aggregate view is a loop around the existing single-record
view, not a parallel model of the same domain rules.

---

## 3. One chart, two meanings

`Progress.tsx`'s `TopicBars` component drew "percent of *this student's*
subtopics finished, one bar per topic they've started." The class chart
needs to draw "percent of *the whole class* that has finished this topic,
one bar per topic with content." Visually those are the same shape — a bar
chart of percentages, one bar per topic — so rather than write a second SVG
component that happens to look identical, `TopicBars` moved to
`src/components/sprig/TopicBars.tsx` and changed its input from `topics:
JourneyTopic[]` (which it then computed a percentage *from*) to `items:
{id, title, percent}[]` — a percentage it just draws.

That one change is what makes it usable from both places:

```ts
// Progress.tsx — percent is this ONE student's completedCount / subtopics.length
items={startedTopics.map((t) => ({ id: t.id, title: t.title, percent: /* ... */ }))}

// TeacherStudents.tsx — percent is HOW MANY of the class have this topic marked complete
classTopicCompletion(topics, journeys) // -> [{id, title, percent}]
```

The component itself doesn't know or care which of those two things
`percent` means — it only knows how to turn a 0-100 number into a bar of the
right height. Pushing the "what does this number mean" decision out to the
caller is what let one component serve two genuinely different questions
without an `if (mode === "teacher")` branch anywhere inside it.

**The general lesson:** when two features want "the same chart, different
numbers," the fix is almost always to narrow the component's job down to
just the drawing, and let each caller compute its own meaning for the
number before handing it over — not to teach the component both meanings.

---

## 4. Choosing the class chart's grain: per-topic, not per-subtopic or per-student

The requirement was open-ended — "average completion percentage… or a
distribution" — so this was worth deciding deliberately rather than
defaulting to whichever was easiest to query. Three candidate grains:

- **Per-student** (one bar per student, their own %): this is just the
  roster rows again, in bar-chart form — no new information for a class of
  more than a handful of names, and it doesn't scale past visual clutter.
- **Completion-band distribution** ("6 students are 0–25% done, 4 are
  50–75%…"): answers "is my class mostly done or mostly stuck," but not
  *where* they're stuck.
- **Per-topic, % of class who finished it** (what got built): for each Tier
  1 topic, `doneCount / classSize`. This is the one that answers the
  question a teacher mid-term actually has — "which topic is the class
  bottlenecked on" — and it's the one dimension the per-student roster rows
  *can't* already show, since each roster row only tells you about one
  student's aggregate position, not which specific topic is slow for
  everyone.

```ts
export function classTopicCompletion(topics: RawTopic[], journeys: Journey[]): ClassTopicCompletion[] {
  return topics
    .filter((t) => t.subtopics.length > 0) // only topics with content
    .map((topic) => {
      const doneCount = journeys.filter(
        (j) => j.topics.find((t) => t.id === topic.id)?.status === "complete",
      ).length;
      return { id: topic.id, title: topic.title, percent: Math.round((doneCount / classSize) * 100) };
    });
}
```

The `.filter((t) => t.subtopics.length > 0)` guard is the same
`hasContent` idea from `deriveJourney()`, restated at the class level: a
topic nobody has written subtopics for would otherwise show 0% for every
student and read as "the whole class is stuck here," when the true story is
"there's nothing here yet." CLAUDE.md's own "only Tier 1 has content" line
turned out to be stale — Tiers 2 and 3 have been seeded since (30 July, 5
August), so this filter is now doing real work: it's the only thing standing
between the chart and 20 bars instead of 15. See section 6 for what that
actually did to the chart once real data was behind it.

---

## 5. Design decision made with the user before writing code

The class-wide graph could reasonably have been per-topic bars, a
completion-band distribution, or both together. Rather than guess, this was
put to the user directly as three concrete previews before any component was
written — per-topic bars won, on the reasoning in section 4 above. Getting
this answered up front (along with confirming the RLS gap by reading the
actual migrations, not assuming) meant the whole build was a single pass
with no rework.

---

## 6. Verifying with a real class, not just a clean migration run

The migration was pasted into the Supabase SQL Editor by hand, same as
always in this project — DB credentials never go near this tool (see
`TECHNICAL_LOG_July21.md`). But "the migration ran without error" only
proves the SQL parsed, exactly as `TECHNICAL_LOG_Aug8.md` found when it
tested the teacher-actions audit log: it proves nothing about whether a
teacher's session can actually *see* the right rows. That needed a real
probe.

**Setup.** `scripts/create-teacher.ts` made a throwaway
`test-teacher-progress@sprig.study`, and `scripts/create-students.ts`
made three throwaway students under it — Dusky Lapwing, Hopeful Swift,
Merry Marten. A scratch script (service-role key, deleted afterward, never
committed) then wrote real `progress` rows directly: Dusky Lapwing finished
one whole topic, Hopeful Swift finished two topics plus one loose subtopic
of a third, Merry Marten finished nothing — a deliberately uneven spread to
make the roster and chart math checkable by hand rather than just "looks
plausible."

**Proving the RLS policy, behaviorally.** A second scratch script signed in
*as* the throwaway teacher with the publishable key — the same client and
`signInWithPassword()` flow the real login page uses — and read `progress`
and `students` exactly as the browser would:

```
progress rows visible to this teacher session: 13
Grouped by student_id: { <Dusky>: 4, <Hopeful>: 9 }
students visible to this teacher session: [ 'Dusky Lapwing', 'Hopeful Swift', 'Merry Marten' ]
progress rows for a student NOT in this teacher's class: 0 (must be 0)
```

`error: null` on every one of those calls is the load-bearing detail — the
new policy isn't just present, it resolves to exactly this teacher's three
students and nothing else, with a real signed session doing the asking.

**Then the actual page.** Signed in as the throwaway teacher in a real
browser tab (`claude-in-chrome`) and loaded `/teacher`. The roster showed
`Tier I · Where Money Really Comes From · 4/60` for Dusky Lapwing,
`Tier I · Making Money Decisions With What You Have · 9/60` for Hopeful
Swift, `Tier I · The Psychology of Spending · 0/60` for Merry Marten — all
three arithmetically exact against the seed. The class-average stat read
"7% average complete", which is `round((7 + 15 + 0) / 3)` — the three
students' own `percentComplete` values averaged and rounded, matching
`classAverageCompletion()` by hand.

**What broke, and why it's a genuine bug rather than a seed-data quirk.**
The per-topic chart rendered as an unreadable smear of overlapping text.
The cause traces back to the correction in section 4: `TopicBars` was moved
from a fixed 460px-wide SVG (fine for the ≤5 topics a student has actually
*started*) to drawing every topic-with-content across the whole class — and
because Tiers 2–3 have real content now, that's 15 topics, not 5. The old
component divided a fixed width by item count, so bar width and label
space shrank as more items were passed in; past about 6 items the two-line
labels became wider than the column they sat in and started bleeding into
their neighbors. This was unreachable in the original student-facing use
(nobody starts more than a handful of topics at once) and was the *first*
thing a class-wide chart with real content behind it hit.

**The fix**, in `src/components/sprig/TopicBars.tsx`: bar width and gap are
now fixed constants rather than `totalWidth / count`, so a column is always
wide enough for its label regardless of how many bars there are; the SVG's
own width grows with the item count instead of shrinking to fit a box that
was never sized for 15 items; and the wrapping div scrolls horizontally
when the chart is wider than its panel. Labels also gained a hard
character-count truncation (`shortLabel()` now truncates each line to 14
characters with an ellipsis) rather than relying purely on splitting words
in half, because a handful of real topic titles ("Where Money Really Comes
From") were still wide enough to overlap their neighbor even at the new
fixed column width. Re-tested against the same throwaway class afterward:
all 15 bars distinct and legible, values unchanged, ellipsis only kicking
in on the genuinely long titles.

**Regression check.** Logged in as Dusky Lapwing (through the real
nickname/PIN flow, forced PIN change and all) and loaded `/progress` — the
student-facing page still renders a single 100% bar for "The Psychology of
Spending" through the same shared `TopicBars` component, unaffected by the
fix above.

**Cleanup.** A third scratch script deleted the seeded `progress` rows
first (`progress.student_id → students(id)` has no `ON DELETE CASCADE`, so
deleting a student while rows still reference them would fail), then
deleted the three throwaway student accounts, then the throwaway teacher —
confirmed empty afterward by re-querying both `students` and `teachers` for
the throwaway ids. All three scratch scripts were deleted; none were
committed.

**The general lesson, twice over.** First, the one `TECHNICAL_LOG_Aug8.md`
already named: a migration completing without error proves syntax, not
behavior — the only way to know a policy scopes correctly is to sign in as
the role it's meant to scope and read through it for real. Second, a new
one: a component that has only ever been called with small, unrepresentative
input (5 topics because that's all a student had touched) can hide a scaling
bug indefinitely — the bug wasn't in the new code that called `TopicBars`,
it was already latent in the component, waiting for the first caller that
handed it a realistic amount of data.

---

## What was verified

| Check | Result |
|---|---|
| Read every existing RLS policy on `progress`, `students`, `test_attempts` directly from the migration files (not assumed) | ✅ confirmed no teacher policy on `progress` existed before today |
| Migration applied to the actual Supabase project (pasted by hand, per this project's workflow) | ✅ |
| New policy proven behaviorally: signed in as a real (throwaway) teacher and read `progress`/`students` through the browser's own auth flow | ✅ exactly 13 rows, exactly 3 students, 0 rows leaked from outside the class |
| Roster's per-student tier/topic/completion line, checked by hand against seeded data | ✅ all three students exact |
| Class chart's per-topic percentages and headline average, checked by hand | ✅ 67%/33%/0%s and "7% average" match the seed exactly |
| Chart legibility at realistic scale (15 topics, not 5) | ❌ found broken (overlapping labels) → ✅ fixed and re-verified in-browser |
| Student-facing Progress page regression check after the `TopicBars` lift-out | ✅ renders correctly, real login flow, real PIN change |
| Unlock/Reset PIN still functional | ✅ unaffected (not touched this session) |
| Throwaway teacher, 3 students, and all seeded `progress` rows fully removed afterward | ✅ confirmed empty by re-query, not just "the script didn't error" |
| `npx tsc --noEmit` across the whole project | ✅ clean |
| `npm run lint` (oxlint) | ✅ clean on all changed files (one pre-existing, unrelated warning in `TestFlow.tsx`) |
| `npm run build` (full production build) | ✅ succeeds |
