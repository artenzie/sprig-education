/**
 * Turning the whole cohort's rows into the six things the host dashboard says.
 *
 * Same split as journey.ts and testMastery.ts, for the same reason: no React,
 * no Supabase, data in and data out. hostData.ts does the fetching; this file
 * does the arithmetic, and can be reasoned about (and one day tested) without
 * a database anywhere near it.
 *
 * Nothing here re-implements a rule that already exists. Per-student
 * completion goes through deriveJourney(), the same function the student's own
 * dashboard uses, and per-question mastery goes through latestOutcomes() from
 * testMastery.ts. A second copy of "what counts as complete" that disagreed
 * with the first would be a bug nobody would find for months.
 */

import { deriveJourney, type Journey, type RawTopic } from "@/lib/journey";
import { latestOutcomes } from "@/lib/testMastery";
import type { AnswerOutcome } from "@/lib/testAttempts";
import type { TopicBarItem } from "@/components/sprig/TopicBars";
import type {
  HostDailyCheckin,
  HostStudent,
  HostTeacher,
  HostTestAttempt,
  HostWeeklyCheckin,
} from "@/lib/hostData";

// ---------------------------------------------------------------------------
// Per-student journeys
// ---------------------------------------------------------------------------

/**
 * One Journey per student, from the same curriculum and the same rules the
 * student sees on their own dashboard.
 *
 * Students with no progress rows still get an entry, built from an empty set.
 * Skipping them would quietly shrink the denominator of every average below,
 * turning "half the cohort hasn't started" into "the cohort is doing great".
 */
export function journeysByStudent(
  topics: RawTopic[],
  students: HostStudent[],
  progressByStudentId: Map<string, Set<string>>,
): Map<string, Journey> {
  const map = new Map<string, Journey>();
  for (const student of students) {
    map.set(
      student.id,
      deriveJourney(topics, progressByStudentId.get(student.id) ?? new Set<string>()),
    );
  }
  return map;
}

// ---------------------------------------------------------------------------
// 1. Overview
// ---------------------------------------------------------------------------

export type HostOverview = {
  students: number;
  teachers: number;
  schools: number;
  /** Students whose teacher_id is null — invisible to every teacher. */
  unassigned: number;
  /** Mean of each student's own percentComplete. */
  averageCompletion: number;
  /** Students with at least one completed subtopic. */
  started: number;
};

export function hostOverview(
  students: HostStudent[],
  teachers: HostTeacher[],
  journeys: Map<string, Journey>,
): HostOverview {
  const list = [...journeys.values()];

  // Counted from distinct non-null school names rather than from the teacher
  // count. Three teachers at one school is one school, and the pilot is
  // explicitly three schools with more than one teacher expected at some.
  const schools = new Set(
    teachers.map((t) => t.school_name?.trim()).filter((name): name is string => Boolean(name)),
  );

  return {
    students: students.length,
    teachers: teachers.length,
    schools: schools.size,
    unassigned: students.filter((s) => s.teacher_id === null).length,
    averageCompletion:
      list.length === 0 ? 0 : Math.round(list.reduce((n, j) => n + j.percentComplete, 0) / list.length),
    started: list.filter((j) => j.completedSubtopics > 0).length,
  };
}

export type TierCompletion = {
  tier: number;
  /** Total subtopics in the tier. Tiers with none are omitted by the caller. */
  subtopics: number;
  /** Mean across students of (completed in tier / subtopics in tier). */
  percent: number;
};

/**
 * Completion broken down by tier.
 *
 * Computed straight from the curriculum and the completion sets rather than
 * from Journey, because Journey deliberately reports one overall percentage
 * and a current topic — it has no per-tier notion, and adding one there to
 * serve this page would push a host-only concept into the type every student's
 * dashboard depends on.
 *
 * A tier with no content is omitted rather than shown at 0%, the same rule
 * topicMastery() uses: a 0% bar claims the cohort failed, when the truth is
 * there was nothing to do. Tier 4 was empty for most of the project's life and
 * this is decided from the data, never hardcoded.
 */
export function tierCompletion(
  topics: RawTopic[],
  students: HostStudent[],
  progressByStudentId: Map<string, Set<string>>,
): TierCompletion[] {
  const tiers = [...new Set(topics.map((t) => t.tier))].sort((a, b) => a - b);

  return tiers
    .map((tier) => {
      const subtopicIds = topics
        .filter((t) => t.tier === tier)
        .flatMap((t) => t.subtopics.map((s) => s.id));

      if (subtopicIds.length === 0 || students.length === 0) {
        return { tier, subtopics: subtopicIds.length, percent: 0 };
      }

      const total = students.reduce((sum, student) => {
        const done = progressByStudentId.get(student.id) ?? new Set<string>();
        const doneHere = subtopicIds.filter((id) => done.has(id)).length;
        return sum + doneHere / subtopicIds.length;
      }, 0);

      return {
        tier,
        subtopics: subtopicIds.length,
        percent: Math.round((total / students.length) * 100),
      };
    })
    .filter((t) => t.subtopics > 0);
}

// ---------------------------------------------------------------------------
// 3. Satisfaction
// ---------------------------------------------------------------------------

export type MoodBreakdown = {
  counts: { sad: number; meh: number; happy: number };
  /** Percentages that sum to exactly 100 (see percentages() below). */
  percent: { sad: number; meh: number; happy: number };
  total: number;
};

export function moodBreakdown(daily: HostDailyCheckin[]): MoodBreakdown {
  const counts = { sad: 0, meh: 0, happy: 0 };
  for (const row of daily) {
    if (row.mood === "sad" || row.mood === "meh" || row.mood === "happy") counts[row.mood] += 1;
  }
  const total = counts.sad + counts.meh + counts.happy;
  const [sad, meh, happy] = percentages([counts.sad, counts.meh, counts.happy]);
  return { counts, percent: { sad, meh, happy }, total };
}

export type WeeklyAverages = {
  /** Mean of the 1-5 confidence answers, to one decimal. Null when nobody answered. */
  confidence: number | null;
  confidenceCount: number;
  /**
   * "Did you finish this week's lessons?" is a three-way choice (0 not really,
   * 1 some, 2 yes all), so its mean is reported alongside the breakdown rather
   * than on its own: an average of 1.0 could be everyone saying "some", or
   * half the cohort saying "not really" and half saying "yes, all", and those
   * are completely different weeks.
   */
  completion: number | null;
  completionCounts: { notReally: number; some: number; all: number };
  completionCount: number;
  weeks: number;
};

export function weeklyAverages(weekly: HostWeeklyCheckin[]): WeeklyAverages {
  const confidences = weekly
    .map((w) => w.confidence)
    .filter((c): c is number => typeof c === "number");
  const completions = weekly
    .map((w) => w.completion)
    .filter((c): c is number => typeof c === "number");

  const counts = { notReally: 0, some: 0, all: 0 };
  for (const value of completions) {
    if (value === 0) counts.notReally += 1;
    else if (value === 1) counts.some += 1;
    else if (value === 2) counts.all += 1;
  }

  return {
    confidence: confidences.length === 0 ? null : round1(mean(confidences)),
    confidenceCount: confidences.length,
    completion: completions.length === 0 ? null : round1(mean(completions)),
    completionCounts: counts,
    completionCount: completions.length,
    weeks: new Set(weekly.map((w) => w.week)).size,
  };
}

export type FreeTextResponse = {
  key: string;
  /** Which question this answered. */
  kind: "confused_by" | "liked_most" | "daily_note";
  text: string;
  /** ISO date — the week for weekly answers, the day for daily notes. */
  when: string;
  nickname: string | null;
};

/**
 * Every free-text answer a student has written, newest first.
 *
 * Blank and whitespace-only answers are dropped: the textareas are optional
 * and an empty one is not a response, it is the absence of one. Showing them
 * would pad the list with nothing and make it look like more was said than
 * was.
 */
export function freeTextResponses(
  weekly: HostWeeklyCheckin[],
  daily: HostDailyCheckin[],
  nicknameById: Map<string, string>,
): FreeTextResponse[] {
  const out: FreeTextResponse[] = [];

  for (const row of weekly) {
    const nickname = nicknameById.get(row.student_id) ?? null;
    if (row.confused_by?.trim()) {
      out.push({
        key: `${row.student_id}:${row.week}:confused`,
        kind: "confused_by",
        text: row.confused_by.trim(),
        when: row.week,
        nickname,
      });
    }
    if (row.liked_most?.trim()) {
      out.push({
        key: `${row.student_id}:${row.week}:liked`,
        kind: "liked_most",
        text: row.liked_most.trim(),
        when: row.week,
        nickname,
      });
    }
  }

  for (const row of daily) {
    if (!row.note?.trim()) continue;
    out.push({
      key: `${row.student_id}:${row.date}:note`,
      kind: "daily_note",
      text: row.note.trim(),
      when: row.date,
      nickname: nicknameById.get(row.student_id) ?? null,
    });
  }

  return out.sort((a, b) => b.when.localeCompare(a.when));
}

// ---------------------------------------------------------------------------
// 5 and 6. Test performance
// ---------------------------------------------------------------------------

export type CohortScores = {
  baseline: { mean: number | null; n: number };
  growth: { mean: number | null; n: number };
  /**
   * The honest comparison: mean improvement among students who have BOTH a
   * baseline and a Growth Check.
   *
   * Subtracting the two cohort means above would compare different
   * populations — the students who have sat a Growth Check are, by definition,
   * the ones who stuck with it, so that number flatters itself. This one is
   * paired per student and cannot.
   */
  paired: { mean: number | null; n: number };
};

/**
 * Baseline versus Growth Check, across the cohort.
 *
 * Each student contributes their FIRST baseline and their LATEST Growth Check.
 * Latest rather than an average of all of them because a Growth Check is meant
 * to measure where someone is now; averaging in an attempt from six weeks ago
 * would drag every improvement back toward the start, which is precisely the
 * mistake latestOutcomes() exists to avoid at the question level.
 */
export function cohortScores(attempts: HostTestAttempt[]): CohortScores {
  const byStudent = groupByStudent(attempts);

  const baselines: number[] = [];
  const growths: number[] = [];
  const deltas: number[] = [];

  for (const rows of byStudent.values()) {
    // groupByStudent sorts oldest-first, so [0] is the earliest baseline and
    // the last growth_check is the most recent.
    const baseline = rows.find((r) => r.test_type === "baseline");
    const growthRows = rows.filter((r) => r.test_type === "growth_check");
    const growth = growthRows[growthRows.length - 1];

    if (baseline) baselines.push(Number(baseline.score));
    if (growth) growths.push(Number(growth.score));
    if (baseline && growth) deltas.push(Number(growth.score) - Number(baseline.score));
  }

  return {
    baseline: { mean: baselines.length ? round1(mean(baselines)) : null, n: baselines.length },
    growth: { mean: growths.length ? round1(mean(growths)) : null, n: growths.length },
    paired: { mean: deltas.length ? round1(mean(deltas)) : null, n: deltas.length },
  };
}

export type TopicDifficulty = TopicBarItem & {
  /** How many latest-per-question outcomes this bar is built from. */
  answers: number;
};

/**
 * Which topics the cohort finds hardest — lowest average score first.
 *
 * THE SUBTLE PART, and the one bug worth guarding against here: latestOutcomes()
 * collapses an attempt history by question_id, keeping only the most recent
 * answer to each question. That is exactly right for ONE student and completely
 * wrong for a cohort — pour everyone's attempts into a single call and two
 * students who answered the same question would collapse into one row, so the
 * result would describe whichever student happened to be processed last rather
 * than the cohort.
 *
 * So it runs PER STUDENT, and the per-student maps are tallied afterwards.
 * Every student contributes exactly one current answer per question they have
 * seen, which is what "the cohort's current mastery of this topic" means.
 *
 * Topics nobody has been tested on are omitted rather than shown at 0%, same
 * rule as topicMastery(): an empty bar reads as failure, not as absence.
 */
export function topicDifficulty(
  attempts: HostTestAttempt[],
  topics: readonly { id: string; title: string }[],
): TopicDifficulty[] {
  const tally = new Map<string, { correct: number; total: number }>();

  for (const rows of groupByStudent(attempts).values()) {
    for (const entry of latestOutcomes(rows).values()) {
      const bucket = tally.get(entry.topicId) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if ((entry.outcome as AnswerOutcome) === "correct") bucket.correct += 1;
      tally.set(entry.topicId, bucket);
    }
  }

  return topics
    .filter((t) => tally.has(t.id))
    .map((t) => {
      const { correct, total } = tally.get(t.id)!;
      return {
        id: t.id,
        title: t.title,
        percent: Math.round((correct / total) * 100),
        answers: total,
      };
    })
    .sort((a, b) => a.percent - b.percent || b.answers - a.answers);
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/**
 * Attempts per student, oldest first.
 *
 * The ordering is not cosmetic: latestOutcomes() walks attempts in order and
 * overwrites per question, so "latest" is only latest if the input is sorted
 * oldest-to-newest. cohortScores() relies on the same ordering to pick a
 * student's first baseline and last Growth Check.
 */
function groupByStudent(attempts: HostTestAttempt[]): Map<string, HostTestAttempt[]> {
  const map = new Map<string, HostTestAttempt[]>();
  for (const attempt of attempts) {
    const list = map.get(attempt.student_id);
    if (list) list.push(attempt);
    else map.set(attempt.student_id, [attempt]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Whole percentages that add up to exactly 100.
 *
 * Rounding each share independently does not: 1/3 each rounds to 33, 33, 33
 * and reads as 99% of the check-ins existing. Largest remainder gives every
 * share its floor, then hands the leftover points to whichever shares were cut
 * hardest — so the three numbers under the mood chart always sum to 100 and
 * nobody has to wonder where the missing percent went.
 */
function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  const out = [...floors];
  for (const { index } of order) {
    if (remaining <= 0) break;
    out[index] += 1;
    remaining -= 1;
  }
  return out;
}
