/**
 * Turning "which subtopics has this student finished?" into everything the UI
 * needs to draw.
 *
 * This file deliberately imports nothing -- no React, no Supabase. It is pure
 * data in, pure data out, so the unlock rules live in one readable place
 * instead of being spread across three components that each re-derive them
 * slightly differently. useJourney.ts does the fetching and calls in here.
 *
 * THE ONE THING TO UNDERSTAND: the database stores only completions. A row in
 * `progress` means "this student finished this subtopic". There is no row for
 * "locked" and none for "available" -- those are *derived* here, every render,
 * from the completion set plus the ordering of the curriculum.
 *
 * Why store it that way? The alternative is writing ~20 `locked` rows per
 * student at sign-up and mutating them as they progress. That needs a backfill
 * for every existing student, and creates two sources of truth that can
 * disagree -- a row saying `locked` for a subtopic the student has actually
 * finished is a bug that cannot happen if the row never existed. Completions
 * are facts; lock states are opinions about facts. Store the facts.
 *
 * The cost, stated honestly: `progress.status` has three allowed values and we
 * only ever write one of them. `available` and `locked` are dead values in the
 * enum. That is a deliberate trade, not an oversight.
 */

/** A subtopic the student can see: finished, open to start, or not yet reachable. */
export type SubtopicStatus = "complete" | "available" | "locked";

/**
 * A topic node on the journey tree. Note this vocabulary differs from
 * SubtopicStatus: the tree has always drawn exactly one node as "current" (the
 * glowing one), so a topic is complete, current, or locked -- never "available"
 * in the abstract. Under the sequential rule below, at most one topic can ever
 * be current, so the two vocabularies line up without needing a fourth state.
 */
export type TopicStatus = "complete" | "current" | "locked";

export type RawSubtopic = { id: string; order: number; title: string };

export type RawTopic = {
  id: string;
  tier: number;
  order: number;
  title: string;
  subtopics: RawSubtopic[];
};

export type JourneySubtopic = RawSubtopic & { status: SubtopicStatus };

export type JourneyTopic = {
  id: string;
  tier: number;
  order: number;
  title: string;
  subtopics: JourneySubtopic[];
  status: TopicStatus;
  /** How many of this topic's subtopics are finished. */
  completedCount: number;
  /**
   * Whether any content has been authored for this topic yet. Tiers 2-4 exist
   * as topics but have no subtopics seeded, and this flag is what stops them
   * being treated as finished -- see the guard in deriveJourney().
   */
  hasContent: boolean;
};

export type Journey = {
  topics: JourneyTopic[];
  totalSubtopics: number;
  completedSubtopics: number;
  /** 0-100, rounded. The dashboard's progress bar. */
  percentComplete: number;
  /** The topic the student is currently working through, if any. */
  currentTopic: JourneyTopic | null;
  /** Where "continue" should send them: the next unfinished subtopic. */
  nextUp: { topic: JourneyTopic; subtopic: JourneySubtopic } | null;
};

/**
 * Build the whole journey view from the curriculum plus the set of finished
 * subtopic ids.
 *
 * The unlock rules, in one place:
 *
 *   - A subtopic is complete if the student has a row for it.
 *   - The first subtopic of a topic is available; every later one needs the
 *     one before it finished.
 *   - A topic is complete when ALL its subtopics are.
 *   - A topic is reachable when the topic before it is complete. The first
 *     topic is always reachable.
 *   - A topic nobody has written content for is never reachable and never
 *     complete.
 */
export function deriveJourney(rawTopics: RawTopic[], completedIds: Set<string>): Journey {
  // Sort defensively. Postgres makes no ordering promise on a nested select
  // unless asked, and the whole unlock chain below is positional -- an
  // out-of-order array would silently unlock the wrong things.
  const ordered = [...rawTopics].sort((a, b) => a.tier - b.tier || a.order - b.order);

  const topics: JourneyTopic[] = [];
  let previousTopicComplete = true; // the first topic has nothing to wait for

  for (const raw of ordered) {
    const subtopics = [...raw.subtopics].sort((a, b) => a.order - b.order);
    const hasContent = subtopics.length > 0;
    const completedCount = subtopics.filter((s) => completedIds.has(s.id)).length;

    // The guard that matters. Without `hasContent`, "every subtopic is
    // complete" is vacuously TRUE for a topic with zero subtopics -- so all 15
    // unseeded topics in tiers 2-4 would report complete, light up the entire
    // canopy, and drag the progress percentage to 100%. An empty topic is not
    // a finished topic.
    const isComplete = hasContent && completedCount === subtopics.length;
    const isReachable = previousTopicComplete && hasContent;

    let status: TopicStatus;
    if (isComplete) {
      status = "complete";
    } else if (isReachable) {
      status = "current";
    } else {
      status = "locked";
    }

    // A locked topic's subtopics are all locked, whatever their own position
    // says -- you cannot start subtopic 1 of a topic you have not reached.
    const journeySubtopics: JourneySubtopic[] = subtopics.map((sub, i) => {
      if (completedIds.has(sub.id)) return { ...sub, status: "complete" };
      if (status === "locked") return { ...sub, status: "locked" };
      const previousDone = i === 0 || completedIds.has(subtopics[i - 1].id);
      return { ...sub, status: previousDone ? "available" : "locked" };
    });

    topics.push({
      id: raw.id,
      tier: raw.tier,
      order: raw.order,
      title: raw.title,
      subtopics: journeySubtopics,
      status,
      completedCount,
      hasContent,
    });

    // Feed this topic's completeness into the next iteration. An empty topic
    // is not complete, so it also acts as a wall: nothing after an unseeded
    // topic can unlock, which is exactly what we want while tiers 2-4 are
    // empty.
    previousTopicComplete = isComplete;
  }

  const totalSubtopics = topics.reduce((n, t) => n + t.subtopics.length, 0);
  const completedSubtopics = topics.reduce((n, t) => n + t.completedCount, 0);

  const currentTopic = topics.find((t) => t.status === "current") ?? null;
  const nextSubtopic = currentTopic?.subtopics.find((s) => s.status === "available") ?? null;

  return {
    topics,
    totalSubtopics,
    completedSubtopics,
    percentComplete: totalSubtopics === 0 ? 0 : Math.round((completedSubtopics / totalSubtopics) * 100),
    currentTopic,
    nextUp: currentTopic && nextSubtopic ? { topic: currentTopic, subtopic: nextSubtopic } : null,
  };
}

/** An empty journey, for the loading state — saves every caller a null check. */
export const EMPTY_JOURNEY: Journey = {
  topics: [],
  totalSubtopics: 0,
  completedSubtopics: 0,
  percentComplete: 0,
  currentTopic: null,
  nextUp: null,
};

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(num: number): string {
  let n = num;
  let result = "";
  for (const [value, symbol] of ROMAN) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result || "I";
}

/** Matches the canopy branch labels on the journey tree. */
export const TIER_NAME: Record<number, string> = {
  1: "Essentials",
  2: "Application",
  3: "Mathematics",
  4: "Mastery",
};
