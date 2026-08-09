/**
 * Turning a `questions` row into the shape QuestionCard renders and grades.
 *
 * This lived inside Lesson.tsx until the test flow needed exactly the same
 * translation. Two copies of it would have been the kind of duplication that
 * looks harmless and then drifts: the day someone adds a question type, or
 * changes how `correct_answer` is encoded for `multi`, the copy they forget
 * about starts marking correct answers wrong. Grading logic gets one home.
 *
 * The encoding it decodes, which is worth knowing when reading the seed SQL:
 * `correct_answer` is text for every type, so an mcq stores "1" (an option
 * index), a multi stores "[0,1,2]" (a JSON array of indices), a num stores
 * "20", and a text question stores the canonical answer with any alternatives
 * in `accepted_answers`.
 */

import { supabase } from "@/lib/supabase";
import type { Question } from "@/components/sprig/QuestionCard";

/** A `questions` row, as the columns the app actually reads. */
export type DbQuestion = {
  id: string;
  question_type: "mcq" | "multi" | "num" | "text";
  question_text: string;
  options: string[];
  correct_answer: string;
  accepted_answers: string[] | null;
  tolerance: number | null;
  explanation: string | null;
};

export function mapQuestion(q: DbQuestion): Question {
  const explanation = q.explanation ?? "";
  if (q.question_type === "mcq") {
    return {
      question_type: "mcq",
      prompt: q.question_text,
      options: q.options,
      correctIndex: parseInt(q.correct_answer, 10),
      explanation,
    };
  }
  if (q.question_type === "multi") {
    return {
      question_type: "multi",
      prompt: q.question_text,
      options: q.options,
      correctIndices: JSON.parse(q.correct_answer),
      explanation,
    };
  }
  if (q.question_type === "num") {
    return {
      question_type: "num",
      prompt: q.question_text,
      correctValue: parseFloat(q.correct_answer),
      tolerance: q.tolerance,
      explanation,
    };
  }
  return {
    question_type: "text",
    prompt: q.question_text,
    acceptedAnswers: q.accepted_answers ?? [q.correct_answer],
    explanation,
  };
}

/**
 * The correct answer as a sentence, for showing on a results screen.
 *
 * Reads the mapped Question rather than the raw row so it cannot disagree with
 * what was actually graded.
 */
export function describeCorrectAnswer(question: Question): string {
  if (question.question_type === "mcq") {
    return question.options[question.correctIndex] ?? "—";
  }
  if (question.question_type === "multi") {
    return question.correctIndices
      .map((i) => question.options[i])
      .filter(Boolean)
      .join(" · ");
  }
  if (question.question_type === "num") {
    return String(question.correctValue);
  }
  return question.acceptedAnswers[0] ?? "—";
}

/**
 * Look up question rows by id — for rebuilding a missed-question card weeks
 * after the attempt, from ids stored in `test_attempts.answers`.
 *
 * `questions` grants public select to `authenticated`
 * (20260724020000_grant_public_content_read.sql), so this needs no RLS of its
 * own. Short-circuits on an empty list rather than sending `.in("id", [])`,
 * which Supabase would otherwise happily turn into a real (pointless) request.
 */
export async function fetchQuestionsByIds(
  ids: readonly string[],
): Promise<{ ok: true; questions: DbQuestion[] } | { ok: false; message: string }> {
  if (ids.length === 0) return { ok: true, questions: [] };

  const { data, error } = await supabase
    .from("questions")
    .select("id, question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation")
    .in("id", ids);

  if (error) return { ok: false, message: error.message };
  return { ok: true, questions: (data ?? []) as DbQuestion[] };
}
