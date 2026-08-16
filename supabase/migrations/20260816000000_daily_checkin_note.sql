-- Sprig: give the daily check-in somewhere to put the note.
--
-- The modal has always had an optional "anything you want to share?" textarea,
-- but `daily_checkins` is (student_id, date, mood) and nothing else -- so the
-- note had nowhere to go. That was survivable only while the modal wrote
-- nothing at all. Now that it writes for real, the column has to exist or the
-- textarea becomes a lie told to a 13-year-old.
--
-- Nullable, no default: null means "they didn't write anything", which is the
-- normal case and is different from "" in a way worth keeping.
alter table daily_checkins add column if not exists note text;

-- Pin the mood vocabulary to the three faces the modal actually offers.
--
-- The original column was a bare `text not null`, which would happily accept
-- 'Rough' or 'happy ' or anything else a future refactor sent it. Three values,
-- matching the Mood union in src/components/sprig/CheckInModal.tsx -- if that
-- union changes, this constraint changes with it, the same arrangement as
-- students.avatar_leaf.
alter table daily_checkins drop constraint if exists daily_checkins_mood_check;
alter table daily_checkins add constraint daily_checkins_mood_check
  check (mood in ('sad', 'meh', 'happy'));

-- No new grants or policies. 20260725010000_student_rls_policies.sql already
-- gives `authenticated` select/insert/update on this table behind
-- auth.uid() = student_id, and a new column inherits that automatically --
-- policies are per-table, not per-column.
--
-- Deliberately still not readable by teachers. 20260809000000 opened up
-- `progress` (completions only); mood stays private to the student, for the
-- same reason test scores and check-in text do.
