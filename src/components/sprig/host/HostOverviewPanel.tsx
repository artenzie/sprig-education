import { TIER_NAME, toRoman } from "@/lib/journey";
import type { HostOverview, TierCompletion } from "@/lib/hostAggregate";
import { Section, StatTile } from "./HostSection";

/**
 * The top of the host dashboard: how big the pilot is, and how far through it
 * the cohort is.
 *
 * The per-tier bars are horizontal rather than reusing <TopicBars />. That
 * component draws a fixed-width column per item and scrolls sideways past
 * about six, which is right for fifteen-plus topics and wrong for three or
 * four tiers — they would sit in the far left of a wide box looking like a
 * chart that failed to load.
 */
export function HostOverviewPanel({
  overview,
  tiers,
}: {
  overview: HostOverview;
  tiers: TierCompletion[];
}) {
  return (
    <>
      <Section
        label="The pilot"
        summary={`${overview.students} student${overview.students === 1 ? "" : "s"}`}
      >
        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0">
          <StatTile
            value={overview.students}
            label="Students"
            // Surfaced rather than buried because an unassigned student is
            // invisible to every teacher — the RLS policy matches on
            // teacher_id and null is never equal to anything. They would
            // otherwise only be noticeable as a class that seems short.
            hint={
              overview.unassigned > 0
                ? `${overview.unassigned} not assigned to a teacher`
                : undefined
            }
          />
          <StatTile value={overview.teachers} label="Teachers" />
          <StatTile value={overview.schools} label="Schools" />
          <StatTile
            value={`${overview.averageCompletion}%`}
            label="Average complete"
            hint={`${overview.started} of ${overview.students} have started`}
          />
        </div>
      </Section>

      <Section
        label="Completion by tier"
        summary={tiers.length === 0 ? "—" : `${tiers.length} tiers with content`}
      >
        {tiers.length === 0 ? (
          <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
            No curriculum content has been seeded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {tiers.map((tier) => (
              <li key={tier.tier} className="px-8 py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[14.5px] text-foreground">
                    Tier {toRoman(tier.tier)}
                    <span className="ml-2 text-muted-foreground">
                      {TIER_NAME[tier.tier] ?? ""}
                    </span>
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {tier.percent}% · {tier.subtopics} subtopic
                    {tier.subtopics === 1 ? "" : "s"}
                  </p>
                </div>
                <div
                  className="mt-3 h-1.5 w-full bg-border/50"
                  role="img"
                  aria-label={`Tier ${toRoman(tier.tier)} is ${tier.percent}% complete across the cohort`}
                >
                  <div
                    className="h-full bg-forest"
                    style={{ width: `${Math.max(tier.percent, tier.percent > 0 ? 1 : 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
