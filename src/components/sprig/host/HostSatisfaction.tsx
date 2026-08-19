import { useState } from "react";
import type { FreeTextResponse, MoodBreakdown, WeeklyAverages } from "@/lib/hostAggregate";
import { Section, StatTile } from "./HostSection";

/**
 * How the pilot feels, as opposed to how it is doing.
 *
 * This is the section that reads most differently from everything else in
 * Sprig, and it is worth naming why: these are children's own words about
 * whether the thing is working. Nothing here is scored, ranked or turned into
 * a metric with a target. The mood split is a proportion, the weekly numbers
 * are averages with their sample size attached, and the free text is shown
 * verbatim and unabridged.
 *
 * NOT VISIBLE TO TEACHERS, and that is deliberate rather than incidental — see
 * the closing note in 20260727000000_teacher_accounts.sql. A student writing
 * "I found this really confusing and I feel stupid" wrote it for the person
 * building Sprig, not for the person marking their work.
 */
export function HostSatisfaction({
  mood,
  weekly,
  responses,
}: {
  mood: MoodBreakdown;
  weekly: WeeklyAverages;
  responses: FreeTextResponse[];
}) {
  return (
    <>
      <Section
        label="Daily mood"
        summary={mood.total === 0 ? "—" : `${mood.total} check-in${mood.total === 1 ? "" : "s"}`}
      >
        {mood.total === 0 ? (
          <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
            No daily check-ins yet.
          </p>
        ) : (
          <>
            {/* One bar rather than three, because these are parts of a whole
                and three separate bars would invite reading them as three
                independent measures. */}
            <div
              className="flex h-2 w-full"
              role="img"
              aria-label={`${mood.percent.happy}% happy, ${mood.percent.meh} percent in between, ${mood.percent.sad}% low`}
            >
              <span className="bg-forest" style={{ width: `${mood.percent.happy}%` }} />
              <span className="bg-forest/40" style={{ width: `${mood.percent.meh}%` }} />
              <span className="bg-terracotta" style={{ width: `${mood.percent.sad}%` }} />
            </div>
            <div className="grid grid-cols-3 divide-x divide-border/70">
              <StatTile
                value={`${mood.percent.happy}%`}
                label="Good"
                hint={checkins(mood.counts.happy)}
              />
              <StatTile
                value={`${mood.percent.meh}%`}
                label="In between"
                hint={checkins(mood.counts.meh)}
              />
              <StatTile
                value={`${mood.percent.sad}%`}
                label="Low"
                hint={checkins(mood.counts.sad)}
              />
            </div>
          </>
        )}
      </Section>

      <Section
        label="Weekly check-in"
        summary={weekly.weeks === 0 ? "—" : `${weekly.weeks} week${weekly.weeks === 1 ? "" : "s"}`}
      >
        {weekly.confidenceCount === 0 && weekly.completionCount === 0 ? (
          <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
            No weekly check-ins yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <StatTile
              value={weekly.confidence === null ? "—" : `${weekly.confidence} / 5`}
              label="Confidence"
              hint={`${weekly.confidenceCount} answer${weekly.confidenceCount === 1 ? "" : "s"}`}
            />
            {/* The mean is shown WITH the split, never instead of it. An
                average of 1.0 on a three-way question could be everyone
                answering "some", or half the cohort split between the two
                extremes, and those are different weeks entirely. */}
            <div className="px-8 py-7">
              <p className="font-display text-[38px] font-normal leading-none tracking-[-0.03em] text-foreground">
                {weekly.completion === null ? "—" : `${weekly.completion} / 2`}
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Finished the week's lessons
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-muted-foreground">
                {weekly.completionCounts.all} yes all · {weekly.completionCounts.some} some ·{" "}
                {weekly.completionCounts.notReally} not really
              </p>
            </div>
          </div>
        )}
      </Section>

      <FreeText responses={responses} />
    </>
  );
}

/** "1 check-in", not "1 check-ins". */
function checkins(n: number): string {
  return `${n} check-in${n === 1 ? "" : "s"}`;
}

const KIND_LABEL: Record<FreeTextResponse["kind"], string> = {
  confused_by: "What confused them",
  liked_most: "What was useful",
  daily_note: "Daily note",
};

/**
 * The written answers.
 *
 * Capped at a page's worth with a "show all" rather than paginated: the whole
 * point of this list is that somebody actually reads it, and a paginated
 * feedback list is one nobody gets to the end of.
 */
function FreeText({ responses }: { responses: FreeTextResponse[] }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 25;
  const visible = showAll ? responses : responses.slice(0, INITIAL);

  return (
    <Section
      label="In their words"
      summary={responses.length === 0 ? "—" : `${responses.length} response${responses.length === 1 ? "" : "s"}`}
    >
      {responses.length === 0 ? (
        <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
          Nobody has written anything yet. These are the optional boxes on the daily and
          weekly check-ins.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border/70">
            {visible.map((response) => (
              <li key={response.key} className="px-8 py-6">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <span className="text-forest">{KIND_LABEL[response.kind]}</span>
                  <span>{response.nickname ?? "Unknown student"}</span>
                  <span>{response.when}</span>
                </div>
                {/* whitespace-pre-line so a student who pressed enter twice
                    gets the paragraphs they typed. */}
                <p className="mt-3 whitespace-pre-line text-[14.5px] leading-[1.75] text-foreground">
                  {response.text}
                </p>
              </li>
            ))}
          </ul>
          {responses.length > INITIAL && !showAll && (
            <div className="border-t border-border/70 px-8 py-5">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                Show all {responses.length}
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
