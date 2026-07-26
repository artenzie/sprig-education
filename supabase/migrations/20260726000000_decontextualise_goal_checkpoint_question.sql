-- Question 61e19c00 read "Using the example above, at what amount would the
-- halfway checkpoint sit?" -- which is unanswerable in a test.
--
-- "The example above" is the question immediately before it in the same
-- subtopic (order 1: "Target: £80 headphones. You save £5 a week."), backed by
-- the Example A slide with the same numbers. Inside the Lesson flow the
-- referent is genuinely there, one question up the page, so the phrasing was
-- correct when it was written.
--
-- The baseline and Growth Check flows broke that assumption. selectTestQuestions()
-- shuffles within a topic and deals round-robin across topics, so a question
-- arrives with no guarantee that anything preceding it is on screen -- or in
-- the paper at all. This one was drawn into a real baseline on 26 July with its
-- referent absent, leaving a numeric input and no numbers.
--
-- The fix restates the target and the rate in the question itself. The answer
-- is unchanged (£40 -- half of £80, reached at week 8 when saving £5 a week),
-- so no stored attempt is invalidated by this edit.
--
-- The explanation is also made self-contained: it previously leaned on the same
-- missing context to justify "week 8".
--
-- Written as an id-scoped update rather than a delete-and-reinsert so the id
-- survives: questions_shown / answers in test_attempts reference question ids,
-- and replacing the row would orphan every attempt that already contains it.
-- Re-running is harmless -- the second run writes identical values.
update questions
   set question_text =
         'Target: £80 headphones, saving £5 a week. At what amount would the halfway checkpoint sit?',
       explanation =
         '£40 — half of £80 — which lands at week 8 when you''re saving £5 a week. If you''re well short of it by then, you''ve found out with two months still available to adjust.'
 where id = '61e19c00-886c-4e53-be84-9fa8a9468a41';
