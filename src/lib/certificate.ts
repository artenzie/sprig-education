/**
 * Has this student earned the certificate, and what should it say?
 *
 * Like journey.ts, this file imports nothing and does no fetching -- data in,
 * data out -- so the one rule that decides whether a keepsake is real lives in
 * a place you can read in thirty seconds, rather than being spread through the
 * JSX of a 400-line page.
 *
 * THE RULE, from the original design: Tier 1 (Essentials, the trunk) complete,
 * plus at least one of the three optional branches -- Application (2),
 * Mathematics (3), Mastery (4). Tier 1 alone is not enough; two optional tiers
 * without Tier 1 is not enough either.
 *
 * A note on what "one optional tier" means in practice today. The unlock chain
 * in deriveJourney() is strictly sequential across the whole curriculum: topic
 * N opens when topic N-1 is complete, and that ordering does not restart at a
 * tier boundary. So the only optional tier a student can currently finish
 * first is Tier 2. The rule is still written as "any one of 2, 3, 4" rather
 * than "Tier 2", because it is the *design's* rule and it survives unchanged
 * if the tree ever lets students pick a branch. Encoding today's traversal
 * order into the certificate would be encoding an accident.
 */

import type { Journey, JourneyTopic } from "./journey";

/** Tier 1 is the trunk; 2-4 are the optional canopy branches. */
const TRUNK_TIER = 1;
const OPTIONAL_TIERS = [2, 3, 4];

export type CertificateTier = {
  tier: number;
  /** How many of this tier's subtopics are finished, and out of how many. */
  completed: number;
  total: number;
  complete: boolean;
};

export type CertificateState = {
  /** The gate. Everything downloadable is behind this. */
  earned: boolean;
  trunkComplete: boolean;
  /** Every tier that has content, in order, with real counts. */
  tiers: CertificateTier[];
  /** Just the finished ones -- what actually gets printed on the card. */
  completedTiers: CertificateTier[];
  /**
   * ISO timestamp of the last completion among the tiers named on the
   * certificate, or null if it is not earned (or if those rows predate
   * completed_at being written).
   */
  earnedOn: string | null;
};

/**
 * @param journey    from deriveJourney()
 * @param completedAt subtopic id -> completion timestamp, from useJourney
 */
export function deriveCertificate(
  journey: Journey,
  completedAt: Map<string, string | null>,
): CertificateState {
  // Only tiers with content count. Same guard as deriveJourney's `hasContent`:
  // a tier nobody has written is not a tier everybody has finished, and
  // "every subtopic complete" is vacuously true when there are no subtopics.
  const tiersPresent = [...new Set(journey.topics.filter((t) => t.hasContent).map((t) => t.tier))].sort(
    (a, b) => a - b,
  );

  const tiers: CertificateTier[] = tiersPresent.map((tier) => {
    const topics = journey.topics.filter((t) => t.tier === tier && t.hasContent);
    const completed = topics.reduce((n, t) => n + t.completedCount, 0);
    const total = topics.reduce((n, t) => n + t.subtopics.length, 0);
    return { tier, completed, total, complete: total > 0 && completed === total };
  });

  const trunkComplete = tiers.some((t) => t.tier === TRUNK_TIER && t.complete);
  const optionalComplete = tiers.some((t) => OPTIONAL_TIERS.includes(t.tier) && t.complete);
  const earned = trunkComplete && optionalComplete;

  const completedTiers = tiers.filter((t) => t.complete);

  return {
    earned,
    trunkComplete,
    tiers,
    completedTiers,
    earnedOn: earned ? lastCompletionAmong(journey.topics, completedTiers, completedAt) : null,
  };
}

/**
 * The latest completion timestamp across the tiers the certificate names.
 *
 * Why this and not `new Date()`: a certificate dated today would re-date itself
 * every time the student opened the page, which makes it a screenshot of when
 * they last looked rather than a record of when they finished. Why not the
 * latest completion overall: that would drift forward as they continue into a
 * tier the certificate does not mention yet.
 *
 * It does move forward when a *new* tier is finished and joins the list -- and
 * that is correct, because the certificate now attests to something more than
 * it did yesterday.
 */
function lastCompletionAmong(
  topics: JourneyTopic[],
  completedTiers: CertificateTier[],
  completedAt: Map<string, string | null>,
): string | null {
  const tiers = new Set(completedTiers.map((t) => t.tier));
  let latest: string | null = null;

  for (const topic of topics) {
    if (!tiers.has(topic.tier)) continue;
    for (const sub of topic.subtopics) {
      const at = completedAt.get(sub.id);
      // Rows written before completed_at existed come back null. Skipping them
      // means an old account dates from its newest completion rather than from
      // nothing at all.
      if (!at) continue;
      if (latest === null || at > latest) latest = at;
    }
  }

  return latest;
}

/** The certificate's own date format: "6 August 2026". */
export function formatCertificateDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
