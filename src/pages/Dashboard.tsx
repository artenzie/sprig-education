import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

import { CheckInModal } from "@/components/sprig/CheckInModal";
import { WeeklyCheckInModal } from "@/components/sprig/WeeklyCheckInModal";
import { JourneyTree } from "@/components/sprig/JourneyTree";
import { useJourney } from "@/hooks/useJourney";
import { useWeeklyCheckin } from "@/hooks/useWeeklyCheckin";
import { useDailyCheckin } from "@/hooks/useDailyCheckin";
import { TIER_NAME, toRoman } from "@/lib/journey";

function Dashboard() {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [weeklyCheckInOpen, setWeeklyCheckInOpen] = useState(false);
  const navigate = useNavigate();
  const { journey, loading } = useJourney();
  const { dueThisWeek, loading: weeklyLoading, submit: submitWeeklyCheckin } = useWeeklyCheckin();
  const { dueToday, loading: dailyLoading, submit: submitDailyCheckin } = useDailyCheckin();

  const { percentComplete, currentTopic, nextUp } = journey;

  // "Chapter" is the current topic's position within its own tier, so a
  // student on the fourth of Tier 1's five topics reads "IV of V".
  const topicsInTier = currentTopic
    ? journey.topics.filter((t) => t.tier === currentTopic.tier).length
    : 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto max-w-[1280px] px-10 pt-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-1 items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Progress
            </span>
            <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-forest/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-forest transition-[width] duration-700 ease-out"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {loading ? "—" : `${percentComplete}%`}
            </span>
          </div>
          {/* Three states, not two. While the row lookup is in flight the
              button is neither shown nor hidden — a prompt that appears and
              then vanishes a beat later reads as a glitch, and the student may
              have clicked it already. */}
          {dailyLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border/40 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
              Check-in
            </span>
          ) : dueToday ? (
            <button
              type="button"
              onClick={() => setCheckInOpen(true)}
              className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-forest/50 hover:text-forest"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-forest" />
              How did today go?
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-forest/25 bg-forest/5 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-forest/80">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Checked in today
            </span>
          )}

        </div>
      </div>

      <main className="mx-auto grid max-w-[1280px] grid-cols-12 gap-16 px-10 pb-24 pt-10">

        {/* Left editorial rail */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="sticky top-24">
            <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              <span>The Sprig Journey</span>
            </div>


            <h1 className="mt-8 font-display text-[62px] font-normal leading-[0.98] tracking-[-0.035em] text-foreground">
              Help your
              <br />
              <em className="font-normal italic text-forest">sprig</em> grow.
            </h1>

            <p className="mt-6 max-w-sm text-[14.5px] leading-[1.7] text-muted-foreground">
              A field guide to money, drawn from the ground up. The trunk
              teaches the essentials; the canopy branches into the paths
              you choose to explore.
            </p>

            <div className="mt-10 h-px w-full bg-border" />

            {/* Editorial stats.
                Streak and Experience used to sit here on hardcoded values (12
                days, 2,480 xp). Both are still gone rather than faked. The
                daily check-in now writes real rows, so a streak has a source at
                last — but one row per student so far is not a streak, and the
                rule for what breaks one (weekends? term holidays?) is a
                pedagogical decision, not a coding one. XP still has no rule
                defining what a subtopic is worth. They come back when there is
                something real behind them. */}
            <dl className="mt-8 grid grid-cols-2 gap-y-7">
              <MetaStat label="Tier" value={currentTopic ? TIER_NAME[currentTopic.tier] ?? "Sprig" : "—"} />
              <MetaStat
                label="Chapter"
                value={currentTopic ? `${toRoman(currentTopic.order)} of ${toRoman(topicsInTier)}` : "—"}
              />
              <MetaStat
                label="Lessons"
                value={loading ? "—" : `${journey.completedSubtopics} / ${journey.totalSubtopics}`}
                suffix={loading ? undefined : "done"}
              />
              <MetaStat label="Next" value={nextUp ? nextUp.subtopic.title : "—"} accent />
            </dl>


            <div className="mt-10 h-px w-full bg-border" />

            {nextUp && (
              <button
                onClick={() =>
                  navigate(`/lesson?topic=${nextUp.topic.id}&subtopic=${nextUp.subtopic.id}`)
                }
                className="group mt-8 inline-flex items-center gap-3 text-left"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Continue reading
                  </span>
                  <span className="block text-[15px] font-medium text-foreground">
                    {toRoman(nextUp.topic.tier)}.{toRoman(nextUp.topic.order)} &nbsp;{nextUp.subtopic.title}
                  </span>
                </span>
              </button>
            )}

            <p className="mt-10 max-w-xs font-mono text-[10.5px] uppercase leading-[1.9] tracking-[0.22em] text-muted-foreground/80">
              Read bottom &nbsp;→&nbsp; top
              <br />
              Twig · Trunk · Branch · Leaf
            </p>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8">
          {dueThisWeek && !weeklyLoading && (
            <div className="mb-8 flex items-center justify-between gap-6 rounded-2xl border border-border bg-card/40 px-6 py-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  Weekly check-in
                </div>
                <p className="mt-2 text-[14.5px] text-foreground/90">
                  Two minutes on how this week went — it helps shape what comes next.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeeklyCheckInOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Take a minute
              </button>
            </div>
          )}
          <JourneyTree journey={journey} />
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1280px] items-center justify-center px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
        </div>
      </footer>

      <CheckInModal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSubmit={submitDailyCheckin}
      />
      <WeeklyCheckInModal
        open={weeklyCheckInOpen}
        onClose={() => setWeeklyCheckInOpen(false)}
        onSubmit={submitWeeklyCheckin}
      />
    </div>
  );
}

function MetaStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1.5 font-display text-[24px] leading-none tracking-[-0.02em] ${
          accent ? "text-terracotta italic" : "text-foreground"
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-1 font-sans text-[11px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}

export default Dashboard;
