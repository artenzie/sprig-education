/**
 * Turning stored test attempts into "how well do you know this topic right
 * now" and "what's still worth another look" — the two things `test_attempts`
 * has always been able to answer but nothing ever asked.
 *
 * Same shape of idea as journey.ts: no React, no Supabase, pure data in and
 * out. The one fact this file leans on is that `test_attempts.questions_shown`
 * already carries `topic_id` for every question, denormalised onto the
 * attempt at write time (see saveTestAttempt in testAttempts.ts) — so mastery
 * never needs a join back through subtopics to topics.
 *
 * LATEST WINS, NOT LIFETIME AVERAGE. A question can be answered on more than
 * one attempt (a student retaking a Progress Check on a topic they missed).
 * Averaging every appearance would mean a topic they've since nailed still
 * drags down because of one bad attempt weeks ago. `latestOutcomes` walks
 * attempts oldest-to-newest and overwrites per question_id, so whatever's
 * left after the loop is "as of their most recent attempt at this question" —
 * current mastery, not history.
 */

import type { AnswerOutcome, TestAttemptRow, TestType } from "@/lib/testAttempts";
import type { TopicBarItem } from "@/components/sprig/TopicBars";

export type LatestOutcome = {
  questionId: string;
  topicId: string;
  subtopicId: string;
  outcome: AnswerOutcome;
  testType: TestType;
};

/**
 * One entry per question the student has ever been asked, holding only their
 * most recent attempt at it. `questions_shown` and `answers` are parallel
 * arrays stored on the same row, matched here by `question_id` rather than by
 * index — cheap, and doesn't depend on write-time ordering never changing.
 */
export function latestOutcomes(attempts: readonly TestAttemptRow[]): Map<string, LatestOutcome> {
  const latest = new Map<string, LatestOutcome>();

  for (const attempt of attempts) {
    const shown = attempt.questions_shown ?? [];
    const answers = attempt.answers ?? [];
    const outcomeById = new Map(answers.map((a) => [a.question_id, a.outcome]));

    for (const q of shown) {
      const outcome = outcomeById.get(q.question_id);
      if (!outcome) continue;
      latest.set(q.question_id, {
        questionId: q.question_id,
        topicId: q.topic_id,
        subtopicId: q.subtopic_id,
        outcome,
        testType: attempt.test_type,
      });
    }
  }

  return latest;
}

/**
 * Per-topic mastery: `correct / (correct + incorrect + unsure)`, among each
 * topic's latest-per-question outcomes. Unsure sits in the denominator, same
 * rule and same reasoning as scoreAttempt() in testAttempts.ts — "not sure
 * yet" is not mastered, but it must never score worse than a wrong guess
 * would have.
 *
 * Ordered the same as the `topics` array passed in, so callers get
 * tier/order sorting for free by passing `journey.topics` straight through.
 * A topic with no tested questions is omitted, not shown at 0%: a bar reading
 * 0% looks like "you got every question wrong," which is a different claim
 * from "you have never been tested on this."
 */
export function topicMastery(
  latest: Map<string, LatestOutcome>,
  topics: readonly { id: string; title: string }[],
): TopicBarItem[] {
  const byTopic = new Map<string, AnswerOutcome[]>();
  for (const entry of latest.values()) {
    const list = byTopic.get(entry.topicId);
    if (list) list.push(entry.outcome);
    else byTopic.set(entry.topicId, [entry.outcome]);
  }

  return topics
    .filter((t) => byTopic.has(t.id))
    .map((t) => {
      const outcomes = byTopic.get(t.id)!;
      const correct = outcomes.filter((o) => o === "correct").length;
      return { id: t.id, title: t.title, percent: Math.round((correct / outcomes.length) * 100) };
    });
}

/**
 * Question ids still worth another look: incorrect or unsure on the most
 * recent attempt that tested them. A question answered correctly since drops
 * off — "worth another look" means still unresolved, not "ever missed."
 */
export function missedQuestionIds(latest: Map<string, LatestOutcome>): string[] {
  return [...latest.values()].filter((e) => e.outcome !== "correct").map((e) => e.questionId);
}
