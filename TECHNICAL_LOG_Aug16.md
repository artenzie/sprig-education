# Technical log — 16 August 2026

## What we did today

Closed four of the five "known-incomplete" items listed at the bottom of
yesterday's log — the ones that were not broken so much as pretending. The
Certificate now checks whether it has been earned before letting anyone
download it, the Library runs on real curriculum data instead of a hardcoded
array, the TopNav notifications say true things, and the daily check-in
actually writes a row. The topic video button was left alone deliberately.

One migration went with it (`daily_checkins.note`), applied to the live
database and verified. Everything below was tested end-to-end on a throwaway
student account, which was deleted afterwards.

The theme running through all four: **each one replaced an invented value with
a derived one.** That is a bigger change than it sounds, because a derived
value has to come from somewhere, and finding that somewhere is most of the
work. The Certificate needed a rule nobody had written down in code. The
Library needed to stop owning a copy of the curriculum. The check-in needed a
column that did not exist.

---

## 1. The Certificate: from a picture of a certificate to a certificate

### What was wrong

The page rendered a complete, fully-earned certificate for every student,
including one who had just logged in for the first time. It carried the name
"Amelia Kestrel" pre-filled, listed "Tier I — Essentials" and "Tier III —
Mathematics" as complete, dated itself today, and offered a Download PDF
button with no handler on it.

Every one of those five things was hardcoded. None of them touched the
database. A student with zero progress saw a finished certificate belonging to
a person who does not exist.

### The rule, written down once

The design has always said: **Tier 1 (Essentials, the trunk), plus at least one
optional branch** — Application, Mathematics, or Mastery. That sentence existed
in the page's own body copy. It did not exist anywhere the code could read.

It lives in `src/lib/certificate.ts` now, as `deriveCertificate()`. The file
imports nothing and fetches nothing — data in, data out — for exactly the
reason `journey.ts` is built the same way: a rule you can read in thirty
seconds is a rule you can check. Buried in the JSX of a 400-line page, it would
be a rule you take on trust.

```ts
const trunkComplete   = tiers.some((t) => t.tier === TRUNK_TIER && t.complete);
const optionalComplete = tiers.some((t) => OPTIONAL_TIERS.includes(t.tier) && t.complete);
const earned = trunkComplete && optionalComplete;
```

**One subtlety worth understanding.** Under the current unlock chain, the only
optional tier a student can finish first is Tier 2 — `deriveJourney()` unlocks
topic N when topic N-1 is complete, and that ordering does not restart at a
tier boundary, so you cannot reach Mathematics without finishing Application.
So "any one of tiers 2, 3, 4" and "tier 2" describe the same set of students
today.

The rule is still written the general way. This is a real design decision, not
laziness: the *design's* rule is "the trunk and any one branch", and the
strictly-linear traversal is an accident of how the tree currently works. If
the journey ever lets a student pick a branch, the certificate needs no edit.
Encoding today's traversal order into the certificate would be encoding an
accident as if it were an intention — and those are the hardest bugs to find
later, because the code looks deliberate.

### Where the date comes from

`new Date()` was the old answer, and it is wrong in a way that is easy to miss:
a certificate dated today re-dates itself every time the page is opened. It
records when you last *looked*, not when you finished.

The right answer needed data the journey hook was throwing away. `useJourney`
now selects `completed_at` alongside `subtopic_id` and returns a
`Map<subtopicId, completed_at>` beside the journey — deliberately *beside* it,
not inside, because a timestamp changes no unlock rule and `journey.ts` should
stay about unlock rules.

`lastCompletionAmong()` then takes the maximum `completed_at` across only the
tiers the certificate actually names. Not the maximum overall — that would
drift forward as the student carried on into a tier the certificate does not
mention. It does move when a *new* tier is finished and joins the list, which
is correct: the certificate now attests to more than it did yesterday.

One defensive detail: rows written before `completed_at` was populated come
back `null` and are skipped, so an old account dates from its newest real
completion rather than from nothing.

### The locked state

A greyed-out button with no explanation is the worst kind of gate — the student
can see they are locked out but not why, or how close they are. So the gate
explains itself in three places:

1. **A requirement panel** above the card, with the two conditions as
   checkboxes and real counts underneath: `3 of 20 lessons done`, and
   `Closest: Application — 0 of 20`. Those numbers come from the same
   `CertificateTier` records the rule itself runs on, so the explanation cannot
   drift from the decision.
2. **The card itself**, muted (`opacity-[0.62] grayscale-[0.55]`), watermarked
   `NOT YET EARNED`, badged `Preview`, with the name field showing a
   placeholder and the tier list switching from "Tiers completed" to "Tiers in
   progress" with live counts.
3. **The buttons**, disabled, with the padlock replacing the download icon.

It is the *same card* in both states rather than a separate placeholder
component, so a student can see exactly what they are working towards. The
watermark is what makes a screenshot of the preview unusable as a fake — the
muting alone would survive a crop.

### Making the download real, without a PDF library

There is no PDF library in this project and adding one to render a page we
already render perfectly in HTML would be a lot of bundle for no gain. The
browser's own print pipeline does it: "Save as PDF" is a destination in every
modern print dialog, and it gives the student a genuine paper option too, which
is the point of a keepsake.

The interesting part is the CSS, in `index.css`:

```css
@media print {
  body * { visibility: hidden; }
  #certificate-sheet, #certificate-sheet * { visibility: visible; }
  #certificate-sheet { position: absolute; left: 0; top: 0; width: 100%; }
}
```

**Why `visibility` and not `display`.** The obvious version — `display: none`
on everything, then `display: block` on the certificate — does not work. A
`display: none` ancestor removes its entire subtree from layout, and no
descendant can opt back in. `visibility: hidden` is inherited but *overridable*
by a descendant, which makes "hide the world, then show this one card" a
two-rule change instead of a restructuring of the DOM.

The `position: absolute` is not cosmetic either: without it the card prints
wherever it sat under the now-invisible nav and page heading, which is a sheet
of white space followed by a certificate.

**A React detail worth keeping.** "Print blank version" prints the same card
with the name suppressed, which means the blank render has to exist *before*
the print dialog opens. Setting state and calling `window.print()` in the same
handler prints the previous frame — React has not committed yet. So the print
is deferred to an effect:

```tsx
const [blank, setBlank] = useState(false);
const [printQueued, setPrintQueued] = useState(false);

useEffect(() => {
  if (!printQueued) return;
  window.print();
  setPrintQueued(false);
  setBlank(false);
}, [printQueued]);
```

The click sets `blank` and queues; the effect runs after the commit, when the
DOM matches what we want on paper.

### A pre-existing layout bug found on the way

`md:grid-cols-[1.2fr,1fr]` compiles to nothing in Tailwind v4 — arbitrary
values are split on commas, so the two-column actions panel had been silently
stacking. `Progress.tsx` already used the working underscore form
(`[minmax(0,1fr)_minmax(0,1fr)]`). Both instances on this page are now
underscores. Worth remembering as a general v4 gotcha: **commas inside
arbitrary values are separators, not syntax.**

---

## 2. The Library: deleting the second copy of the curriculum

### What was wrong

The page owned a 60-line `TIERS` constant: twenty invented subtopic titles,
each with a hand-written `unlocked: true` or `false`, plus a derived `VIDEOS`
array that assigned runtimes from `["6m", "8m", "9m", "7m", "10m"][i]`.

Two consequences, both visible to a real student:

- A brand-new account was told "4/5 unlocked" in Essentials while having
  unlocked exactly one thing.
- Every row linked to a bare `/lesson`, with no `?topic=` or `?subtopic=`, so
  every row in the entire Library opened the *same* lesson.

### The fix

The whole constant is gone. The page calls `useJourney()` — the same hook
behind the journey tree and the Topic screen — and derives everything:

- tabs from the tiers actually present in `topics`,
- rows from `journey.topics[].subtopics[]`,
- lock state from `SubtopicStatus`,
- links as `/lesson?topic=${topic.id}&subtopic=${sub.id}`, byte-for-byte what
  `Topic.tsx` builds.

"N/M unlocked" now counts subtopics whose status is not `locked` — the honest
reading of the word, and computed from the same statuses that draw the padlocks
one line below, so the header and the rows cannot disagree.

This is the point of having `journey.ts` be pure and `useJourney` be the only
fetcher. Three screens now draw the same unlock rules from one implementation.
The Library's hardcoded array was, in effect, a fourth implementation that
nobody was maintaining.

### The videos, told the truth about

Every `topics.video_url` in all twenty seed migrations is `null` — verified by
query, not by memory: `topics with a video_url: 0 of 20`. So there was no
honest version of a Watch link.

Two things changed rather than one. The old tab listed twenty *per-subtopic*
videos; videos are actually **topic-level** (`Lesson.tsx` opens a topic with
one video, then works through that topic's subtopics), so the list was the
wrong shape as well as fictional. It now lists topics, each row marked "Not
recorded yet" with a dashed placeholder thumbnail and no play button, under a
header reading `20 planned · none recorded yet` and a note explaining that the
slides and questions *are* the lesson.

The lock state on those rows is still real, because the lock is about the
lesson behind the row, and it has to agree with the tree.

---

## 3. TopNav notifications

Three hardcoded items became two hardcoded items, which sounds like no change
and is actually the whole point. The old three claimed a topic had unlocked, a
retake was waiting, and a live session with Artem was happening on Thursday at
4pm. Nothing generated them and nothing could have — there is no notifications
table, no unlock event, no schedule.

The two replacements ("Mastery (Tier 4) has been added", dated 14 August 2026;
"Welcome to Sprig") are true of every student, which is what makes a static
announcements list defensible where a static *notifications* list is not.

Two smaller honesty fixes came with it: the panel is labelled **Announcements**
rather than Notifications, the "3 new" count became a plain count (nothing
records whether this student has read anything, so "new" is unbackable), and
the terracotta unread dot on the bell is gone — a permanent dot would nag every
student forever about two items they read on day one.

---

## 4. The daily check-in: from a modal that lied to a modal that writes

### The pattern, reused

The weekly check-in built earlier gave the exact shape to copy: a hook that
answers "is this due?" by **row presence**, and submits with an `upsert`.
`useDailyCheckin` is a near-copy of `useWeeklyCheckin` with a smaller payload.

The duplication is deliberate. The two differ in their table, their key
(`date` vs `week`), and their payload — a shared abstraction would be three
parameters of configuration wrapping four lines of query. Copying was cheaper
and leaves both readable.

Row presence, rather than "hours since last check-in", matters for a reason
worth internalising: the schema already keys the table on `(student_id, date)`,
so **the primary key is the enforcement**. One-per-day needs no separate check,
no race handling, no clock arithmetic. When the database already encodes a
rule, the client's job is to ask the question the same way the database
answers it.

### `todayKey()` and the timezone trap

`src/lib/day.ts` mirrors `week.ts`, and its one job is to *not* be this:

```ts
new Date().toISOString().slice(0, 10)   // wrong
```

`toISOString()` converts to UTC first. A student checking in at 23:30 in
Barcelona (UTC+2) would be recorded against **tomorrow's** date — and would
then find the prompt gone the next evening, having never checked in that day.
Sprig's pilot schools are all UTC+1/+2, so that is a real evening, not a
theoretical one. Building the string from `getFullYear()` / `getMonth()` /
`getDate()` keeps it in the student's own day.

### The modal

`CheckInModal` had a "Noted — thank you" screen one `setState` after the click,
with nothing behind it. It now `await`s the write and only thanks the student
if the row landed; a failure shows the message instead. A thank-you for
something that was never saved is worse than an error, because the student
stops worrying about it.

The Dashboard button has three states, not two: **loading** (a neutral chip —
a prompt that appears and then vanishes a beat later reads as a glitch, and the
student may already have clicked it), **due** (the original button), and
**done** ("Checked in today", with a tick).

### The migration that had to exist

`daily_checkins` is `(student_id, date, mood)`. The modal has always had an
optional "anything you want to share?" textarea. There was nowhere to put it.

That was survivable while the modal wrote nothing at all. The moment it writes
for real, the textarea becomes a promise — and this one is made to a
13-year-old who may type something that matters. So
`20260816000000_daily_checkin_note.sql` adds `note text` (nullable: null means
"they wrote nothing", which differs from `""` in a way worth keeping) and pins
`mood` to the three values the modal offers, which the original bare
`text not null` did not.

No new grants or policies: `20260725010000` already gives `authenticated`
select/insert/update behind `auth.uid() = student_id`, and **a new column
inherits that automatically — RLS policies are per-table, not per-column.**
Mood stays invisible to teachers, like test scores and check-in text.

**Applied to the live database** via the Supabase SQL editor, and verified by
probing the real table rather than by trusting that the editor said "Success":

```
mood only      -> ok
mood + note    -> ok                      (was: PGRST204, no 'note' column)
bad mood value -> rejected: 23514         (was: ACCEPTED, constraint missing)
```

`23514` is Postgres's `check_violation`. Worth running a probe like this after
any migration that adds a constraint — "the DDL ran" and "the rule is being
enforced" are different claims, and only the second one matters.

---

## 5. What was left alone, and why

**The topic video button.** Left as-is by instruction. Worth recording
accurately though: the null-guard fix landed in `Lesson.tsx`, not `Topic.tsx`.
`Topic.tsx:158` still renders the play button unconditionally with no handler,
regardless of `video_url`. It is inert rather than wrong, and it stays on the
list.

**Streak and XP.** Still absent from the Dashboard. The daily check-in now
gives a streak a real source at last — but one row per student is not a streak,
and the rule for what *breaks* one (weekends? half term?) is a pedagogical
decision, not a coding one. XP still has no rule for what a subtopic is worth.

**The Help contact box.** Was outstanding when this section was first written,
and got done later the same day — see section 7.

---

## 6. How it was actually tested

Not by reading the code and reasoning about it. A scratch account, and the real
UI:

1. `create-students.ts 1` → **Test Student C**, PIN `000000`, forced through
   the real first-login PIN change.
2. Seeded **3 of Tier 1's 20** subtopics via the service-role key (bypasses
   RLS), with backdated `completed_at` values an hour apart so "date earned"
   had something real to be the maximum of.
   → Certificate showed: watermark, `Preview` badge, both requirement rows
   unchecked, `3 OF 20 LESSONS DONE`, `CLOSEST: APPLICATION — 0 OF 20`, tier
   lines `3 of 20 / 0 of 20 / 0 of 20 / 0 of 20`, date earned `—`, both buttons
   disabled, name field disabled reading "Locked until earned".
3. Seeded **all 40 subtopics of Tiers 1 and 2**.
   → Certificate unlocked: gold restored, watermark and badge gone, "Tiers
   completed — I Essentials · II Application", **date earned "4 August 2026"**
   (the seeded maximum, *not* today's 16 August — which is the specific thing
   `lastCompletionAmong()` exists to get right), buttons enabled, typed name
   re-rendering live on the card.
4. Library cross-checked on the same account: Essentials `20/20 unlocked · 20
   done`; Mathematics `1/20 unlocked · 0 done` with only III.I.I openable and
   every other row padlocked — exactly what the sequential rule predicts. A row
   click landed on
   `/lesson?topic=b14567dc…&subtopic=a9ccf186…` and opened the right subtopic
   ("Part 1 of 4" of The Psychology of Spending).
5. Daily check-in, after the migration was applied: Submit correctly disabled
   with no mood chosen; picked "Okay", typed a note, submitted. The row landed
   as

   ```json
   {"student_id":"61f2a037…","date":"2026-08-16","mood":"meh",
    "note":"Compound interest finally clicked today."}
   ```

   `date` is **2026-08-16** — the local day, which is the whole point of
   `todayKey()`. The button flipped to "Checked in today", and stayed that way
   through a full page reload, which is the part that proves the read path and
   not just the write.

### Cleaning up afterwards

The scratch account was deleted by removing the **auth user only** — everything
else went with it, and the script checked that rather than assuming it:

```
before: {"progress":40,"daily":1}
after:  {"student":0,"progress":0,"daily":0}
```

That is two cascades firing in sequence: `students.id` references
`auth.users(id) on delete cascade` (25 July), and `progress` / `daily_checkins`
cascade from `students` (yesterday's migration). Yesterday's work is what makes
today's cleanup a one-liner — before it, deleting a student who had actually
used the app was blocked by foreign keys. `students-2026-08-16.csv` was deleted
too; the four earlier hand-out lists are real pilot accounts and were left
alone.

The principle from yesterday's log holds: **when you want to know whether
something handles your data, run it against your data.** Seeding a real account
and looking at the real page found the Tailwind comma bug in ninety seconds; no
amount of re-reading `deriveCertificate()` would have.

---

## 7. The Help contact box — the last one on the list

Yesterday's log rated this the highest priority of the five known-incomplete
items, for a reason none of the others had: it made a promise to a child asking
for help. The other four looked unfinished. This one told a 13-year-old their
message was on its way when it was not.

### Three states, and why the middle one was not enough

1. It answered a send with "Sent — thank you" and a promised reply within two
   days, while doing nothing with the text at all.
2. A fix after the debugging pass made the button open a `mailto:` link with
   the typed text in the body. Better — it reached a human — but it stored
   nothing, and it assumed a configured mail client. Sprig runs mostly on
   shared school machines, where that assumption is often wrong and fails
   *silently*: the button appears to work and nothing happens.
3. Today: the message is written to `help_messages` through a database
   function.

The `mailto:` survives, but as a link in the prose rather than as the button.
That demotion is the whole design, and it is explained under "The copy" below.

### Why a function, and not an INSERT policy

This is the part worth understanding properly, because the obvious solution is
wrong in a way that is easy to miss.

`/help` is a public route — it has to be, since a teacher evaluating Sprig and
a student who *cannot get past the login screen* both need it, and the second
of those is very plausibly why someone is writing in the first place. So any
direct-table approach needs `grant insert on help_messages to anon`.

The publishable key is in the client bundle. That is what "publishable" means;
it is not a leak. But it means `grant insert to anon` is an unauthenticated
write endpoint that anybody who views source can script against. An RLS policy
could bound *who* writes (anyone, in this case) and nothing else — not what,
not how much.

A `security definer` function bounds all three, and it is the idiom this schema
already uses everywhere the browser cannot be trusted with a decision:
`record_failed_login()` (also granted to `anon`), `set_avatar_leaf()`,
`complete_pin_change()`, the teacher tools. So `help_messages` has RLS on with
**no policies and no grants at all** — unreachable from any browser in either
direction — and `submit_help_message(p_message text)` is the only door.

The single most important line in it:

```sql
v_sender uuid := auth.uid();
```

The client never supplies `student_id` and has no way to. Compare an INSERT
policy, where the client sends the column and the policy can only check it
afterwards. The test suite proves the difference: passing an extra
`student_id` key to the RPC fails with *"Could not find the function
public.submit_help_message(p_message, student_id)"* — it is rejected at the
signature, before any logic runs.

**Reads are nobody's.** Not students, not teachers — only the service role,
which bypasses RLS, which is how these actually get read (a script or the
dashboard; there is no inbox UI yet). A teacher being able to read one child's
message about something upsetting is not a feature, it is a hazard.

### The bug that writing it carefully caught

`auth.uid()` is whoever is signed in — and that is **not necessarily a
student.** Teachers are auth users too and can read `/help` like anyone else,
and `help_messages.student_id` references `public.students`. Writing a
teacher's uid straight in would have failed on the foreign key, so the first
teacher to use the contact box would have got an error and no idea why.

```sql
if v_sender is not null
   and not exists (select 1 from public.students where id = v_sender) then
  v_sender := null;
end if;
```

Falling back to anonymous rather than rejecting: their message is still worth
having. The general lesson is worth keeping — **`auth.uid()` identifies an
account, not a role.** Any code that assumes which table that id lives in
should check.

### Rate limiting, and an honest note about the second guard

Two ceilings, both modelled on `teacher_action_budget_ok()`:

- **Per student, 5/hour.** Well above someone with a real problem writing twice
  because they thought of something else; well below anything worth calling a
  flood.
- **Globally, 60/hour.** This one needs stating plainly rather than burying:
  anonymous senders have no identity to key a limit on, so the only lever left
  is a total, which means **someone determined can trip it and take the form
  away from honest students until the hour rolls forward.** It is a cost
  circuit-breaker, not a spam filter. Sixty an hour against a pilot of roughly
  ninety students is generous enough that normal use will never see it, which
  is the only reason that trade is acceptable. If it ever fires in anger the
  answer is not a bigger number — it is a captcha or a required sign-in, and
  both have their own costs to a child who cannot log in.

Plus a 2000-character bound, checked in the column constraint *and* in the
function — the second one so an over-long message fails with a sentence a
13-year-old can act on rather than a raw Postgres check-violation.

### The copy

The reply-time promise was never the real problem. The real problem is that
**Sprig has nowhere to reply to.** A message from this box is anonymous by
design; even for a signed-in student, Sprig holds a nickname and no address.
So no reply promise of *any* duration is deliverable here — not "within two
days", not "as soon as we can".

Saying that plainly turned out to be more useful than any number:

> Send a note and it goes straight to Artem. He can't reply here — this box
> doesn't know who you are — so if you need an answer back, email
> hello@sprig.study instead.

That is why the `mailto:` stayed: it is still the only route that can get a
*reply*. The button stores; the link replies; the copy says which is which.

"A real person reads every one" stays in the page intro, on the explicit
understanding that it depends on someone actually querying the table. It is a
promise kept by a human habit, not by code, and it is worth writing that down
somewhere — which is here.

One line was added that nobody asked for:

> Please don't include your real name, school, or anything else personal — it
> isn't needed, and Sprig would rather not have it.

Two sections below, the FAQ promises "Sprig only ever sees your nickname." A
free-text box is exactly where a 13-year-old breaks that promise by being
helpful. A privacy guarantee that the UI quietly invites you to violate is not
a guarantee.

### How it was tested

Every path, through the **publishable key** — the same key and the same client
the browser uses — rather than through the service role, which bypasses RLS and
would have proved nothing about what a real visitor can do.

```
anon send                          ok
anon send, blank                   REJECTED: Please write a message before sending.
anon send, 2001 chars              REJECTED: That message is a bit too long...
anon send, exactly 2000            ok
anon direct SELECT                 REJECTED: permission denied for table help_messages
anon direct INSERT                 REJECTED: permission denied for table help_messages
anon rpc w/ extra student_id       REJECTED: Could not find the function ...(p_message, student_id)
student send                       ok
student send, 2001 chars           REJECTED: That message is a bit too long...
student send #2..#5                ok
student send #6                    REJECTED: You have sent a few messages already...
teacher send                       ok
```

And what actually landed:

```
#1 student_id=null        "TEST-ANON: the compound interest slide does not load"
#3 student_id=STUDENT-ID  "TEST-STUDENT: I cannot find the Growth Check on my p"
#8 student_id=null        "TEST-TEACHER: how do I reset a PIN for a whole table"
#9 student_id=null        "TEST-UI: the Buy Now Pay Later lesson stops loading..."
```

Row #8 is the teacher fallback working — a teacher id would have been a foreign
key error, and a teacher id *stored* would have been the bug. Row #9 came
through the actual browser on `/help` while logged out, which also confirmed
the success state, and that "Send another" returns a clean empty form with Send
disabled.

Two boundary checks worth copying elsewhere: **2000 accepted and 2001
rejected** proves the bound is inclusive rather than off by one, and the sixth
message failing after five succeeded proves the rate limit counts what it
claims to.

Afterwards: all 9 rows deleted, and both scratch accounts (student `Careful
Kestrel`, teacher `scratch-help-test@example.invalid`) removed by deleting the
auth user and confirming the cascade. Back to 8 students and the two original
teachers.
