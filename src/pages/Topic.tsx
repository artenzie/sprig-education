import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Play, Circle, Check, Lock } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { supabase } from "@/lib/supabase";
import { useJourney } from "@/hooks/useJourney";
import type { SubtopicStatus } from "@/lib/journey";

/* ---------- Data shapes + fetching ---------- */

type DbSubtopic = {
  id: string;
  title: string;
  order: number;
};

type DbTopic = {
  id: string;
  tier: number;
  order: number;
  title: string;
  description: string | null;
  video_url: string | null;
  subtopics: DbSubtopic[];
};

// Matches the canopy branch labels in JourneyTree — Tier 1 is the trunk,
// Tiers 2-4 are its three canopy branches.
const TIER_NAME: Record<number, string> = {
  1: "Essentials",
  2: "Application",
  3: "Mathematics",
  4: "Mastery",
};

function toRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let result = "";
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result || "I";
}

function Topic() {
  const { topicId } = useParams<{ topicId: string }>();
  const [topic, setTopic] = useState<DbTopic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Two queries on this page, deliberately. This component needs the topic's
  // full detail (description, video_url) which the journey hook doesn't carry;
  // the hook supplies the completion status, so the lock rules live in exactly
  // one place rather than being re-derived here.
  const { journey } = useJourney();

  useEffect(() => {
    let cancelled = false;
    setTopic(null);
    setLoadError(null);
    supabase
      .from("topics")
      .select("*, subtopics(*)")
      .eq("id", topicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError(error?.message ?? "Topic not found.");
          return;
        }
        const raw = data as DbTopic;
        setTopic({
          ...raw,
          subtopics: [...raw.subtopics].sort((a, b) => a.order - b.order),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-10 text-center text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
          Couldn't load this topic
        </span>
        <p className="max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">{loadError}</p>
        <Link
          to="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
        >
          ← Back to your journey
        </Link>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Loading topic…
        </span>
      </div>
    );
  }

  // Real completion, from the student's own progress rows.
  const journeyTopic = journey.topics.find((t) => t.id === topic.id);
  const statusById = new Map<string, SubtopicStatus>(
    (journeyTopic?.subtopics ?? []).map((s) => [s.id, s.status]),
  );
  const completed = journeyTopic?.completedCount ?? 0;
  // "Start here" belongs on one row only — the first one they can actually
  // begin — otherwise every unlocked row shouts for attention equally.
  const startHereId = journeyTopic?.subtopics.find((s) => s.status === "available")?.id ?? null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNav />

      <main className="mx-auto grid max-w-[1280px] grid-cols-12 gap-16 px-10 pb-24 pt-12">
        {/* LEFT — sticky editorial rail */}
        <aside className="col-span-12 lg:col-span-5">
          <div className="sticky top-24">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              {toRoman(topic.tier)}.{toRoman(topic.order)} · {TIER_NAME[topic.tier] ?? "Sprig"}
            </div>

            <h1 className="mt-6 font-display text-[52px] font-normal leading-[1.02] tracking-[-0.03em] text-foreground">
              {topic.title}
            </h1>

            {topic.description && (
              <p className="mt-5 max-w-md text-[14.5px] leading-[1.75] text-muted-foreground">
                {topic.description}
              </p>
            )}

            {/* Video */}
            <div className="mt-10">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-mint/40">
                <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                  <defs>
                    <pattern id="topic-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="0.8" fill="currentColor" className="text-forest/15" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#topic-dots)" />
                </svg>
                <button
                  aria-label="Play topic video"
                  className="group absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform group-hover:scale-105">
                    <Play className="ml-0.5 h-6 w-6 fill-current" strokeWidth={0} />
                  </span>
                </button>
              </div>
              <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                Topic overview
              </div>
            </div>

            {/* Twig progress */}
            <div className="mt-12 flex items-center gap-5">
              <TwigProgress completed={completed} total={topic.subtopics.length} />
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                {completed} of {topic.subtopics.length} complete
              </div>
            </div>

            <div className="mt-12">
              <Link
                to="/dashboard"
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
              >
                ← Back to your journey
              </Link>
            </div>
          </div>
        </aside>

        {/* RIGHT — subtopic list */}
        <section className="col-span-12 lg:col-span-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
            Subtopics
          </div>

          <ul className="mt-6 border-t border-border">
            {topic.subtopics.map((sub) => (
              <SubtopicRow
                key={sub.id}
                topic={topic}
                sub={sub}
                status={statusById.get(sub.id) ?? "locked"}
                isStartHere={sub.id === startHereId}
              />
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
          <span>V1</span>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Subtopic row ---------- */

function SubtopicRow({
  topic,
  sub,
  status,
  isStartHere,
}: {
  topic: DbTopic;
  sub: DbSubtopic;
  status: SubtopicStatus;
  isStartHere: boolean;
}) {
  const roman = `${toRoman(topic.tier)}.${toRoman(topic.order)}.${toRoman(sub.order)}`;
  const isLocked = status === "locked";

  const rowInner = (
    <div
      className={`group flex items-start gap-6 py-8 transition-colors ${
        isLocked ? "opacity-55" : "hover:bg-forest/[0.03]"
      }`}
    >
      <div className="pt-1">
        <StatusIndicator status={status} isStartHere={isStartHere} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>{roman}</span>
          {isStartHere && <span className="tracking-[0.28em] text-terracotta">Start here</span>}
          {status === "complete" && <span className="tracking-[0.28em] text-forest">Complete</span>}
        </div>
        <h3 className="mt-2 text-[19px] font-medium leading-[1.35] text-foreground">{sub.title}</h3>
      </div>
    </div>
  );

  // A locked row renders as plain markup rather than a Link. Note this is a
  // courtesy, not a control: /lesson?subtopic=... typed by hand still loads.
  // That's fine — the only thing a student can reach early is their own
  // curriculum, and the write path records real completions either way.
  if (isLocked) {
    return (
      <li className="border-b border-border" aria-disabled>
        {rowInner}
      </li>
    );
  }

  return (
    <li className="border-b border-border">
      <Link to={`/lesson?topic=${topic.id}&subtopic=${sub.id}`} className="block">
        {rowInner}
      </Link>
    </li>
  );
}

function StatusIndicator({ status, isStartHere }: { status: SubtopicStatus; isStartHere: boolean }) {
  if (status === "complete") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-primary-foreground">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (isStartHere) {
    return (
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-forest/15 blur-[6px]" />
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-forest">
          <span className="h-2.5 w-2.5 rounded-full bg-forest" />
        </span>
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground/70">
        <Lock className="h-2.5 w-2.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground/70">
      <Circle className="h-2.5 w-2.5" strokeWidth={2} />
    </span>
  );
}

/**
 * TwigProgress — decorative horizontal twig with one leaf per subtopic.
 * Filled = complete, outlined = not yet. NOT interactive.
 */
function TwigProgress({ completed, total }: { completed: number; total: number }) {
  const width = 220;
  const height = 64;
  const anchors = Array.from({ length: total }, (_, i) => {
    const t = total > 1 ? (i + 0.5) / total : 0.5;
    const x = 20 + t * (width - 40);
    const y = 44 - Math.sin(t * Math.PI) * 10;
    const rot = -30 - i * 4;
    return { x, y, rot };
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path
        d={`M 10 52 C ${width * 0.3} 44, ${width * 0.65} 30, ${width - 10} 22`}
        fill="none"
        stroke="var(--forest)"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.85}
      />
      {anchors.map((a, i) => {
        const filled = i < completed;
        return (
          <g key={i} transform={`rotate(${a.rot} ${a.x} ${a.y})`}>
            <ellipse
              cx={a.x}
              cy={a.y}
              rx={9}
              ry={3.4}
              fill={filled ? "var(--forest)" : "transparent"}
              stroke="var(--forest)"
              strokeWidth={filled ? 0 : 1.2}
              opacity={filled ? 0.95 : 0.55}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default Topic;
