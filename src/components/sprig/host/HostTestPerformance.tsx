import { TopicBars } from "@/components/sprig/TopicBars";
import type { CohortScores, TopicDifficulty } from "@/lib/hostAggregate";
import { Section, StatTile } from "./HostSection";

/**
 * How the cohort is actually doing, and which topics are hardest.
 *
 * The first thing to say about this section is that it shows numbers no
 * teacher can see. 20260727000000 and 20260809000000 both drew that line on
 * purpose — a teacher sees completions and never a score — and it is still
 * drawn. What is different here is that these are cohort figures for the
 * person building the curriculum, not a class list with marks against names.
 * There is deliberately no per-student score anywhere on this page.
 */
export function HostTestPerformance({
  scores,
  difficulty,
}: {
  scores: CohortScores;
  difficulty: TopicDifficulty[];
}) {
  const hasAny = scores.baseline.n > 0 || scores.growth.n > 0;

  return (
    <>
      <Section
        label="Baseline vs Growth Check"
        summary={hasAny ? `${scores.paired.n} paired` : "—"}
      >
        {!hasAny ? (
          <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
            Nobody has sat a test yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatTile
              value={scores.baseline.mean === null ? "—" : `${scores.baseline.mean}%`}
              label="Baseline"
              hint={`${scores.baseline.n} student${scores.baseline.n === 1 ? "" : "s"}`}
            />
            <StatTile
              value={scores.growth.mean === null ? "—" : `${scores.growth.mean}%`}
              label="Latest Growth Check"
              hint={`${scores.growth.n} student${scores.growth.n === 1 ? "" : "s"}`}
            />
            {/* The only one of the three worth drawing a conclusion from, so
                it says so. The two means either side are computed over
                different groups of students — everyone who sat a baseline
                versus everyone who has since sat a Growth Check — and
                subtracting them would measure who stuck with it as much as
                who improved. */}
            <StatTile
              value={
                scores.paired.mean === null
                  ? "—"
                  : `${scores.paired.mean > 0 ? "+" : ""}${scores.paired.mean}`
              }
              label="Change, per student"
              hint={
                scores.paired.n === 0
                  ? "Nobody has both yet"
                  : `Mean across the ${scores.paired.n} with both — the honest comparison`
              }
            />
          </div>
        )}
      </Section>

      <Section
        label="Hardest topics"
        summary={difficulty.length === 0 ? "—" : `${difficulty.length} topic${difficulty.length === 1 ? "" : "s"} tested`}
      >
        {difficulty.length === 0 ? (
          <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
            No test answers yet. This fills in as students sit Progress and Growth Checks.
          </p>
        ) : (
          <div className="px-8 py-10">
            <p className="mb-8 max-w-2xl text-[13.5px] leading-[1.7] text-muted-foreground">
              Lowest average first — each bar is the share of the cohort's most recent
              answers to that topic's questions that were right. A topic nobody has been
              tested on is left out rather than shown at zero.
            </p>
            <TopicBars
              items={difficulty}
              ariaLabel="Average cohort score by topic, lowest first"
            />
            {/* The chart carries no sample size, and a topic sitting at 40%
                off four answers is a very different signal from one sitting
                at 40% off four hundred. */}
            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {difficulty.slice(0, 5).map((topic) => (
                <li key={topic.id}>
                  {topic.title} · {topic.percent}% · {topic.answers} answer
                  {topic.answers === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
