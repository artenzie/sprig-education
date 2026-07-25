/**
 * Choosing which questions appear on a baseline or Growth Check.
 *
 * Like journey.ts, this file imports nothing -- no React, no Supabase. Pure
 * data in, pure data out. The selection rule is the part most worth being able
 * to reason about on its own, so it lives away from the fetching.
 *
 * WHY NOT `order by random()` IN SQL: PostgREST has no way to express it, so it
 * would need a Postgres function and therefore a migration. At 84 questions the
 * whole bank is one small query anyway -- roughly the size of a single lesson's
 * payload, which the app already fetches without anyone noticing. Adding a
 * database function to save fetching 84 rows would be paying a migration for
 * nothing.
 *
 * WHY NOT PLAIN RANDOM: this is the part that actually matters. Dealing 18
 * questions uniformly at random from a bank where one topic has 20 questions
 * and another has 12 regularly produces six from one topic and none from
 * another. A test that claims to cover everything, and then silently skips a
 * fifth of the course, is worse than one that admits its scope. So the
 * selection is *stratified*: shuffle within each topic, then deal round-robin
 * across topics.
 *
 * That also means tier coverage comes for free. Every topic belongs to exactly
 * one tier, so spreading evenly across topics spreads across tiers too -- when
 * tiers 2-4 get seeded, nothing here needs to change.
 */

/** How many questions a baseline or Growth Check aims for. */
export const TEST_QUESTION_COUNT = 18;

/**
 * The minimum any test may be built from. Below this a "test" is not really
 * measuring anything, and a growth chart plotted from 3-question attempts
 * would swing wildly for reasons that have nothing to do with the student.
 */
export const MIN_TEST_QUESTIONS = 5;

/**
 * A question as the selector needs to see it. Deliberately narrow: the
 * selector cares only about identity and which topic it belongs to. The full
 * question body is the caller's business.
 */
export type SelectableQuestion = {
  id: string;
  topicId: string;
};

/**
 * Fisher-Yates, on a copy.
 *
 * Worth writing out rather than reaching for `sort(() => Math.random() - 0.5)`,
 * which is the common one-liner and is genuinely biased -- comparison sorts
 * assume a consistent comparator, and a random one produces distributions that
 * are measurably lopsided. This is the same length and actually uniform.
 *
 * `rand` is injectable so tests can pass a deterministic generator. Production
 * callers just omit it.
 */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick `count` questions spread as evenly as possible across topics.
 *
 * The rules, in one place:
 *
 *   - Questions are grouped by topic and shuffled within each group.
 *   - Topics are dealt from in rotation -- one question each, round and round
 *     -- until the target count is reached.
 *   - A topic that runs out is dropped from the rotation; the remaining topics
 *     absorb its share rather than the test coming up short.
 *   - If the whole bank is smaller than `count`, every question is used. A
 *     shorter test is the correct response to a half-seeded database; throwing
 *     would take the feature away from a student for a content problem.
 *   - The order topics are dealt in is itself shuffled, so when the count does
 *     not divide evenly it is not always the same topics that get the extra
 *     question.
 *   - The result is shuffled at the end, so the student does not experience it
 *     as five blocks of one topic.
 */
export function selectTestQuestions<T extends SelectableQuestion>(
  pool: readonly T[],
  count: number = TEST_QUESTION_COUNT,
  rand: () => number = Math.random,
): T[] {
  if (pool.length === 0 || count <= 0) return [];

  // Group by topic. A Map keeps insertion order, but the deal order gets
  // shuffled below anyway, so nothing here depends on it.
  const byTopic = new Map<string, T[]>();
  for (const question of pool) {
    const existing = byTopic.get(question.topicId);
    if (existing) existing.push(question);
    else byTopic.set(question.topicId, [question]);
  }

  // Shuffle within each topic, and shuffle the order topics are dealt in.
  const queues = shuffle([...byTopic.values()], rand).map((group) => shuffle(group, rand));

  const target = Math.min(count, pool.length);
  const picked: T[] = [];

  // Round-robin. `queues` is filtered each pass so an exhausted topic simply
  // stops being offered a turn -- the loop cannot spin forever because every
  // pass either takes at least one question or has no queues left.
  let live = queues;
  while (picked.length < target && live.length > 0) {
    for (const queue of live) {
      if (picked.length >= target) break;
      const next = queue.pop();
      if (next) picked.push(next);
    }
    live = live.filter((queue) => queue.length > 0);
  }

  return shuffle(picked, rand);
}
