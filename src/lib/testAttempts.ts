/**
 * Scoring a test and storing the attempt.
 *
 * This is the first thing in Sprig to write to `test_attempts`. The table has
 * existed since the initial schema and its RLS policies and grants have been in
 * place since 20260725010000 -- so nothing here needs a migration. It is
 * purely the missing writer.
 *
 * THE THREE-WAY OUTCOME
 *
 * Every answer is `correct`, `incorrect`, or `unsure`. That third value is the
 * point of the whole design, not a convenience.
 *
 * On a four-option question, guessing pays 25% for free. A diagnostic where
 * guessing pays is not measuring what the student knows, it is measuring how
 * willing they are to guess. Offering "I'm not sure yet" only helps if choosing
 * it is never *worse* for the student than a lucky guess would have been -- so
 * an unsure is never shown in red, never called wrong, and never appears as a
 * mistake. It is a different thing: a gap, honestly reported.
 *
 * WHAT `score` MEANS
 *
 * `score` is `correct / total_shown`, as a percentage. Unsures sit in the
 * denominator.
 *
 * The alternative -- scoring out of only the questions attempted -- was
 * considered and rejected, because it lets a student who answers two questions
 * and skips sixteen record 100%, which then lands on the growth chart next to a
 * real 100%. The chart's whole job is comparing an attempt to an earlier
 * attempt, and a denominator that changes with the student's confidence makes
 * that comparison meaningless.
 *
 * Nothing is lost by that choice, because the three-way outcome is stored per
 * question. "Correct out of attempted" is one `.filter()` away whenever anyone
 * wants it. Store the facts; derive the opinions -- the same argument
 * journey.ts makes for storing only completions.
 */

import { supabase } from "@/lib/supabase";

/** The three ways a question can come back. See the note above. */
export type AnswerOutcome = "correct" | "incorrect" | "unsure";

/**
 * What the student actually entered, in the shape the question type produces:
 * an option index for mcq, a list of indices for multi, a number for num, a
 * string for text, and null for an unsure (they entered nothing).
 *
 * Stored so the "worth another look" cards can later show a student what they
 * picked, not merely that they were wrong.
 */
export type QuestionResponse = number | number[] | string | null;

export type TestType = "baseline" | "progress_check" | "growth_check";

/** One answered question, ready to be scored and stored. */
export type AnsweredQuestion = {
  questionId: string;
  topicId: string;
  subtopicId: string;
  outcome: AnswerOutcome;
  response: QuestionResponse;
};

export type AttemptScore = {
  correct: number;
  incorrect: number;
  unsure: number;
  total: number;
  /** 0-100, rounded to one decimal place. `correct / total`. */
  score: number;
};

/**
 * Count the three outcomes and work out the stored score.
 *
 * Rounded to one decimal because 18 does not divide into 100, so almost no
 * real score is a whole number -- 12 out of 18 is 66.666... One decimal stays
 * close to the true ratio while still being a number you can say out loud.
 * More would be false precision: on an 18-question test the smallest possible
 * difference is one question, about 5.6 points, so digits past the first
 * decimal describe nothing a student could actually have done differently.
 */
export function scoreAttempt(answers: readonly AnsweredQuestion[]): AttemptScore {
  const correct = answers.filter((a) => a.outcome === "correct").length;
  const incorrect = answers.filter((a) => a.outcome === "incorrect").length;
  const unsure = answers.filter((a) => a.outcome === "unsure").length;
  const total = answers.length;

  return {
    correct,
    incorrect,
    unsure,
    total,
    score: total === 0 ? 0 : Math.round((correct / total) * 1000) / 10,
  };
}

/** A row read back from `test_attempts`. */
export type TestAttemptRow = {
  id: string;
  test_type: TestType;
  score: number;
  date: string;
  questions_shown: { question_id: string; topic_id: string; subtopic_id: string }[] | null;
  answers: { question_id: string; outcome: AnswerOutcome; response: QuestionResponse }[] | null;
};

/**
 * Write a finished attempt.
 *
 * One insert, at the end, never partial. An abandoned test leaves no row at
 * all, which is the honest record of what happened -- a half-finished attempt
 * stored with a score would show up on the growth chart as a bad week.
 *
 * `questions_shown` and `answers` are stored as two parallel arrays in the
 * order the student saw them, matching the columns the schema already
 * provides. The counts (correct/incorrect/unsure) are deliberately NOT stored:
 * they are derivable from `answers` by the function above, and a stored count
 * that disagrees with the answers it summarises is a bug that cannot happen if
 * it was never stored.
 *
 * Failure is returned, not thrown -- the same contract as
 * markSubtopicComplete(). A student who has just finished eighteen questions
 * should still see their score if the write fails; they just need telling that
 * it may not have saved.
 */
export async function saveTestAttempt(
  studentId: string,
  testType: TestType,
  answers: readonly AnsweredQuestion[],
): Promise<{ ok: true; score: AttemptScore } | { ok: false; message: string }> {
  const score = scoreAttempt(answers);

  const { error } = await supabase.from("test_attempts").insert({
    student_id: studentId,
    test_type: testType,
    score: score.score,
    questions_shown: answers.map((a) => ({
      question_id: a.questionId,
      topic_id: a.topicId,
      subtopic_id: a.subtopicId,
    })),
    answers: answers.map((a) => ({
      question_id: a.questionId,
      outcome: a.outcome,
      response: a.response,
    })),
  });

  return error ? { ok: false, message: error.message } : { ok: true, score };
}

/**
 * Every attempt this student has taken, oldest first.
 *
 * No `.eq("student_id", ...)`, for the same reason useJourney.ts omits it: the
 * RLS policy has already narrowed the table to auth.uid() = student_id.
 * Filtering again in the client would look like the safety came from the query.
 *
 * Oldest-first because both callers want chronological order -- the growth
 * chart plots left to right, and "is this their first test?" is answered by
 * the length either way.
 */
export async function fetchTestAttempts(): Promise<
  { ok: true; attempts: TestAttemptRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("test_attempts")
    .select("id, test_type, score, date, questions_shown, answers")
    .order("date", { ascending: true });

  if (error) return { ok: false, message: error.message };
  return { ok: true, attempts: (data ?? []) as TestAttemptRow[] };
}
