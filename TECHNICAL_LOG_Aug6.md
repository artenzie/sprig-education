# Technical log — 6 August 2026

## What we did today

Wired up Progress Check — the third and last test type, after baseline and
Growth Check. The type, the DB constraint, and the results-saving code path
already existed and were just waiting; what was missing was the
question-selection path: pull questions only from subtopics the student has
actually finished, restricted to whichever topics they pick on the Progress
page. Verified end to end against a real account, including planting and
then removing fabricated completion data used only for that verification.

---

## 1. Three test types, one page, one selector — because the differences are all upstream of it

`TestFlow.tsx` already ran baseline and Growth Check through the exact same
component, same phases (`intro → questions → saving → results`), same
scoring, same save. The only thing that ever differed between them was
*which questions go into the pool before `selectTestQuestions` runs*.
Progress Check fits that same shape — it just needed a third way to build
the pool:

```ts
Promise.all([
  supabase.from("questions").select(POOL_SELECT),
  testType === "progress_check"
    ? supabase.from("progress").select("subtopic_id").eq("status", "complete")
    : Promise.resolve({ data: [], error: null }),
]).then(([poolResult, progressResult]) => {
  let pool = /* ...map to TestQuestion, same as before... */;

  if (testType === "progress_check") {
    const completedSubtopicIds = new Set(progressResult.data.map(r => r.subtopic_id));
    pool = pool.filter(
      q => selectedTopicIds.has(q.topicId) && completedSubtopicIds.has(q.subtopicId),
    );
  }
  // MIN_TEST_QUESTIONS check, then selectTestQuestions(pool, ...) — unchanged.
});
```

Baseline and Growth Check both pass `Promise.resolve({ data: [], error: null })`
for the second query rather than skipping it — same shape either way, so
the `.then` callback doesn't need an `if/else` on which promises actually
ran. Everything downstream of that filter — the round-robin selection, the
score, the save, the results screen — didn't need to know a third test type
exists.

**The general lesson:** when a new variant of something fits an existing
shape, the right amount of new code is *only* the part that's genuinely
different. Progress Check needed one filtering step and two copy branches;
it didn't need a new page, a new save function, or a new type.

---

## 2. Why the round-robin selector didn't need to change for a much smaller pool

`selectTestQuestions` (in `testSelection.ts`) was written for a fixed
84-question bank spread across many topics. Progress Check can hand it a
pool of 7 questions from a single topic — a **12x smaller input**, with a
**third as many groups** (1 topic instead of up to 5). Before touching
anything, the actual algorithm needed checking against that:

```ts
const target = Math.min(count, pool.length);
// round-robin: pop one from each topic's queue per pass, refilter out
// exhausted topics after each pass, stop once `picked.length >= target`
```

Nothing in that loop assumes a minimum number of topics or a minimum pool
size. One topic just means one queue in the rotation — the round-robin
degenerates to "keep popping from the one queue until it's empty or the
target's hit," which is exactly what a normal test does for its *last*
surviving topic anyway. `target = Math.min(count, pool.length)` already
means "use everything if there isn't enough" was true from day one, for
every test type, not something Progress Check needed added.

The only real floor is `MIN_TEST_QUESTIONS = 5`, and that check already
lived in the caller (`TestFlow.tsx`), not inside the selector — so the one
place that needed new logic (a clearer error message for *why* the pool's
too small) was already the right place for it.

**The general lesson:** "does this algorithm handle a smaller input"
is a question worth actually tracing through the code, not assuming from
the fact that it was designed for a bigger one. Here the answer was yes,
and it was yes on purpose — the pool-size guard was already separated from
the selection logic, at the boundary where a new caller could reuse both.

---

## 3. The topic-picker was already built — for a granularity the filter doesn't need to match

`Progress.tsx` already had working toggle-circle UI: `selected: string[]`
holding topic ids, a `toggle(id)` function, pills that highlight when
selected. It just wasn't connected to anything, and the "Start Progress
Check" button was hard-`disabled`.

The picker toggles whole **topics**, not individual subtopics. A student
who's finished 2 of a topic's 4 subtopics can still select that topic. The
naive worry: wouldn't that let unfinished-subtopic questions leak into the
test? It doesn't, because the topic selection and the completion filter are
two *independent* conditions, both applied to the same pool:

```ts
pool.filter(q => selectedTopicIds.has(q.topicId) && completedSubtopicIds.has(q.subtopicId))
```

Selecting a topic only makes it *eligible*; whether any given question in
it actually survives the filter still depends entirely on whether its own
subtopic is in the completed set. A half-finished topic just contributes
fewer questions — never questions from the half that isn't done. That
meant the picker UI didn't need touching at all: topic-granularity
*selection* and subtopic-granularity *correctness* aren't in tension, they
just both have to be checked.

**The general lesson:** when a UI's selection granularity looks coarser
than what correctness requires, check whether the fix belongs in the UI or
in how the selection gets *used*. Here, redesigning the picker to
subtopic-level toggles would have solved a problem the filtering step
already solved on its own.

---

## 4. `?type=progress_check&topics=<ids>` — passing state between two pages that don't share one

`Progress.tsx` and `TestFlow.tsx` are two separate route components with no
shared parent state, no context, no store. The existing baseline/Growth
Check link already solved this with the URL itself: `?type=baseline`. The
new link just extends the same pattern:

```tsx
<Link to={`/test?${new URLSearchParams({ type: "progress_check", topics: selected.join(",") })}`}>
```

and `TestFlow.tsx` reads it back with a small parser:

```ts
function readSelectedTopicIds(raw: string | null): Set<string> {
  return new Set((raw ?? "").split(",").map(s => s.trim()).filter(Boolean));
}
```

This is worth noticing as a pattern, not just a one-off: the URL is a
perfectly good place to hand a small, serializable piece of state from one
page to the next, *especially* when the receiving page should also work
correctly from a bookmark, a page refresh, or a manually typed link — all
of which a React context or in-memory store would lose. The trade-off is
that the receiving end has to treat the input as untrusted and handle it
being empty, garbled, or stale — which is exactly what the next section is
about.

---

## 5. Two different "can't build a test" messages, because they have two different fixes

`TestFlow.tsx` already had one `loadError` state and one message
("There isn't enough content in the question bank yet") for when the whole
bank came back too small. Progress Check needed to *not* reuse that
message, because the actual fix for a too-small Progress Check pool is
never "wait for more content" — the bank might be full; it's *this specific
topic selection* that's thin.

Two distinct cases, checked in order:

```ts
// 1. Nothing selected at all — a routing error (stale bookmark, hand-edited
//    URL), not reachable through the UI since the button is disabled
//    until selected.length > 0:
if (testType === "progress_check" && selectedTopicIds.size === 0) {
  setLoadError("Pick at least one topic on your progress page, then start again.");
  return;
}

// 2. Filtered pool still below MIN_TEST_QUESTIONS — an actionable, specific
//    fix rather than the generic bank-wide message:
"There aren't enough questions yet in the topics you picked. Try selecting
one or two more topics you've finished, or finish more of the ones you
chose."
```

Both reuse the same `CentredNotice` component baseline/Growth Check already
used for their one error case — no new UI, just a second message chosen by
`testType`.

**The general lesson:** an error message is a promise about what the user
should do next. Two failures that look similar ("not enough questions") but
have different fixes ("pick more topics" vs. "the whole bank is thin") are
worth two messages, even when they render through the identical component.

---

## 6. Verifying against a real account, including a real DB write that then had to come back out

Same principle as the 30 July and 5 August sessions: query results and a
green build don't confirm a feature *works*, only that it compiles and the
individual pieces look right in isolation. Confirming the actual behavior —
does the filter really exclude an unfinished subtopic's questions, does the
save write `progress_check` and not `growth_check`, does the Growth chart
still exclude it — needed a real student clicking through a real browser.

The wrinkle: no existing test account had any completed subtopics yet, and
the ones that did have progress had already changed their PIN to something
unrecoverable (PINs are bcrypt-hashed by design — see `studentAuth.ts` — so
there's no "look it up" path, only reset). Rather than reset a PIN on an
account with real prior state, **Earnest Otter** — still on the untouched
default PIN — was logged into fresh, then two `progress` rows were inserted
directly via the service-role key (the same credential `create-students.ts`
and `create-teacher.ts` already use), marking two subtopics of "The
Psychology of Spending" complete:

```js
await admin.from("progress").insert([
  { student_id, subtopic_id: sub1, status: "complete", completed_at: now },
  { student_id, subtopic_id: sub2, status: "complete", completed_at: now },
]);
```

That's a real write, keyed to one specific test account — not a mock, not a
staging environment. The whole flow was then driven for real: log in, land
on `/progress`, see the topic pill for the one started topic, toggle it,
watch the disabled grey button become the live green "Start Progress
Check" link, land on `/test?type=progress_check&topics=<id>` with the
correct "7 questions" count (4 + 3, matching the two completed subtopics
exactly), answer all seven honestly with "I'm not sure yet" to avoid
needing to know real answers, and land on the results screen. Querying
`test_attempts` afterward confirmed the row was real:

```json
{
  "test_type": "progress_check",
  "score": 0,
  "questions_shown": [
    { "subtopic_id": "a9ccf186-...", "topic_id": "b14567dc-..." },
    { "subtopic_id": "ebd28e57-...", "topic_id": "b14567dc-..." }
    // ...5 more, every single one from those exact two subtopic ids
  ]
}
```

Every one of the 7 questions came from exactly the two subtopics marked
complete — none from the topic's other two subtopics, which were never
touched. That's the actual claim from section 3 ("selection and correctness
aren't in tension") confirmed against real data, not just read out of the
code.

**Cleanup, scoped precisely.** The two `progress` rows and the one
`test_attempts` row this session created were fabricated data that doesn't
belong in the database once verification is done — so both were deleted
afterward, filtered to exactly this student and exactly the rows this
session inserted:

```js
await admin.from("test_attempts").delete().eq("student_id", studentId).eq("test_type", "progress_check");
await admin.from("progress").delete().eq("student_id", studentId).in("subtopic_id", [sub1, sub2]);
```

Earnest Otter's PIN change itself was *not* reverted — that's a legitimate
account state (everyone changes their PIN once, on first login), not
injected test data, so leaving it matches the same judgment call the 30
July session made about "Restless Otter."

**The general lesson:** verifying a feature that only matters once real
data exists sometimes means creating real data to verify it against. The
discipline isn't avoiding that — it's making the write precisely scoped
(one student, exactly the rows needed) and removing exactly those rows
afterward, leaving no trace that a real student's history didn't put there.

---

## What was verified

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `npm run lint` (oxlint) | ✅ (one pre-existing-pattern `exhaustive-deps` warning, non-blocking, matches the file's documented "runs once on purpose" effect) |
| `npm run build` | ✅ |
| Topic pill toggle → button enabled/disabled | ✅ grey+disabled with nothing selected, green+`Link` once a topic is picked |
| `/test?type=progress_check` with no `topics` param | ✅ shows the dedicated "pick a topic first" error, not the generic one |
| Question pool size for a 2-subtopic selection | ✅ exactly 7 (4 + 3), matching the two subtopics marked complete |
| Every served question's `subtopic_id` | ✅ only the two completed subtopics — zero from the topic's other two, unfinished subtopics |
| `test_attempts.test_type` on save | ✅ `"progress_check"`, not `"growth_check"` |
| Growth chart after a Progress Check attempt | ✅ still shows "No Growth Checks yet" — `progress_check` correctly excluded from `toGrowthPoints` |
| Fabricated `progress` / `test_attempts` rows | ✅ both deleted after verification, scoped to exactly what this session inserted |

**Not done, and deliberately:** the "worth another look" missed-questions
section on the Progress page still only covers what a student sees at the
end of the test they just took — the persistent, query-back-later version
(`test_attempts.answers` joined back to `questions` weeks later) is still
the same honest gap noted in `Progress.tsx`'s own header comment, unrelated
to today's work.

---
---

# Second session — wiring up the weekly check-in

`weekly_checkins` had existed since the initial schema — `student_id`,
`week`, `confidence`, `completion`, `confused_by`, `liked_most`, RLS already
granting insert/update/select to the owning student — but nothing wrote to
it and there was no UI. Same shape as the first session: the table was never
the missing piece.

---

## 1. A banner in an already-reserved slot, not a fourth competing popup

`Dashboard.tsx` already has a "How did today go?" mood popup (`CheckInModal`)
in the header, and it already has a comment reading
`{/* Right column: reserved for future journey visualization */}` sitting
above the journey tree, doing nothing. Rather than adding a second pill next
to the first one, or auto-opening a modal on every load, the weekly check-in
is a small dismissible-by-ignoring banner card that fills exactly that
reserved slot, and only renders when the week's check-in is missing:

```tsx
{dueThisWeek && !weeklyLoading && (
  <div className="mb-8 flex items-center justify-between gap-6 rounded-2xl border border-border bg-card/40 px-6 py-5">
    {/* eyebrow, one line of copy, "Take a minute" -> opens WeeklyCheckInModal */}
  </div>
)}
```

**The general lesson:** a UI comment that says "reserved for future X" is
worth checking before adding a new location for X — the layout may already
have budgeted the space.

---

## 2. "Due this week" reuses the schema's own unit instead of inventing one

The obvious way to decide "has it been a week" is to store
`last_checkin_at` and compare `Date.now() - lastCheckinAt > 7 days`. That
column doesn't exist, and building it would duplicate something the schema
already expresses: `weekly_checkins.week` is documented as "start date of
the week" and is literally half of the table's primary key
(`primary key (student_id, week)`). One row *is* one calendar week's
check-in. So "due" is just: does a row exist for *this* week's Monday?

```ts
// src/lib/week.ts
export function currentWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  // built from local getFullYear/getMonth/getDate, not toISOString() —
  // toISOString() converts to UTC first, which shifts the date near midnight
  // for any student west of UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

No date library exists anywhere in the repo, and this is small enough not to
add one for. The hook that uses it (`useWeeklyCheckin.ts`) mirrors
`useJourney.ts`'s shape exactly: a cancellation-guarded effect that queries
with no `.eq("student_id", ...)`, because the RLS policy already restricts
`weekly_checkins` to `auth.uid() = student_id` — same reasoning already
documented inline in `useJourney.ts` for the `progress` query, copied rather
than re-derived.

**The general lesson:** before adding a field or a calculation to track
"when did X last happen", check whether an existing column already encodes
the period you actually care about. Here the primary key did the tracking
for free.

---

## 3. Upsert without `ignoreDuplicates` — the opposite choice from `markSubtopicComplete`, on purpose

`markSubtopicComplete` upserts with `{ onConflict: "student_id,subtopic_id", ignoreDuplicates: true }`,
because redoing a finished lesson should never overwrite the original
`completed_at`. The weekly check-in write looks almost identical but drops
that flag:

```ts
await supabase.from("weekly_checkins").upsert(
  { student_id, week: currentWeekStart(), confidence, completion, confused_by, liked_most },
  { onConflict: "student_id,week" },
);
```

The two features look alike (`upsert` + composite key) but the correct
behavior on a second write is opposite: a lesson's first completion date is
worth preserving; a mid-week resubmission of *this week's* check-in should
win, not silently no-op. RLS grants both `insert` and `update` on this table
specifically, which is the schema confirming the same intent.

**The general lesson:** two upserts that share a shape can still need
opposite conflict behavior — the decision has to come from what a second
write *means* for that specific data, not from matching the nearest existing
pattern by default.

---

## 4. Verifying against a real account, and the guardrail that caught the write

Same discipline as the 30 July and this morning's sessions: the banner
rendering and the type-check passing don't confirm the row actually lands
correctly shaped. A throwaway student ("Hopeful Lapwing") was created via
`create-students.ts`, driven through the real login → set-PIN → dashboard
flow in a real browser, the check-in form submitted with real field values,
and the resulting row queried back directly:

```json
{
  "week": "2026-08-03",
  "confidence": 4,
  "completion": 2,
  "confused_by": "Compound interest formulas",
  "liked_most": "The budgeting video"
}
```

`week` landed on the correct Monday, `completion: 2` matched "Yes, all" (the
`0 / 1 / 2` mapping baked into the UI's button order), and a full page
reload afterward confirmed the banner stayed gone — proof the due-check
reads its own write back correctly, not just that the insert succeeded.

Worth recording because it was new this session: creating the throwaway
account was blocked on the first attempt by the coding agent's own
auto-mode classifier, since it's a live write against the connected
Supabase project. It surfaced as a question rather than silently skipping
or silently proceeding — the account was created only after an explicit
yes. Same spirit as every other real-data write in this project's sessions:
scoped to exactly one throwaway student, and fully undone afterward —
`weekly_checkins` row, `students` row, and the `auth.users` row all deleted
by student id, unlike Earnest Otter's PIN change earlier today, which was
legitimate account state and stayed.

**The general lesson:** a tool that pauses on a real write against a live
project — even your own, even for testing — is doing its job. The right
response is to answer the question, not route around it.

---

## What was verified (second session)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `oxlint` on the new/changed files | ✅ clean |
| Banner appears when no row exists for the current week | ✅ |
| Modal submit writes a row with the correct Monday, mapped `completion` int, trimmed-or-null optional text | ✅ |
| Banner disappears immediately after submit, and stays gone after a full reload | ✅ |
| Throwaway test account and its check-in row | ✅ fully deleted after verification |
