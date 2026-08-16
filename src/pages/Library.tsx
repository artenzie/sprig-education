import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, Lock, ArrowUpRight, Film } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { useJourney } from "@/hooks/useJourney";
import { TIER_NAME, toRoman, type JourneyTopic } from "@/lib/journey";

/**
 * The Library — the same curriculum as the journey tree, flattened.
 *
 * This page used to run on a hardcoded TIERS array: twenty invented subtopic
 * titles with hand-written `unlocked: true/false` flags, and every row linking
 * to a bare `/lesson` that landed on whichever topic that route defaulted to.
 * It told a brand-new student they had "4/5 unlocked" in Essentials and then
 * dropped them into a lesson they had not reached. All of it is gone; the page
 * now derives from the same useJourney() hook the tree and the Topic screen
 * use, so there is exactly one place where unlock rules live.
 *
 * Video is the one thing still not real, and it is not real anywhere: every
 * `topics.video_url` in all twenty seed migrations is null, because none have
 * been recorded. So the video parts say so, rather than inventing a runtime
 * and a Watch link.
 */

/* ---------- Icons ---------- */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BookIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 4.5C4 4.22 4.22 4 4.5 4H11v15H4.5a.5.5 0 0 1-.5-.5v-14Z" />
      <path d="M20 4.5a.5.5 0 0 0-.5-.5H13v15h6.5a.5.5 0 0 0 .5-.5v-14Z" />
      <path d="M11 4v15M7 7.5h1.5M7 10.5h1.5M15.5 7.5H17M15.5 10.5H17" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3.5 7.5C3.5 6.4 4.4 5.5 5.5 5.5h12A2 2 0 0 1 19.5 7.5v9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-9Z" />
      <path d="M15.5 12.5h4v-3h-4a1.5 1.5 0 0 0 0 3Z" />
      <path d="M3.5 8.5c0-1.66 1.34-3 3-3h9" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <rect x="7.5" y="6" width="9" height="3" rx="0.6" />
      <path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 8.5 7.5 13 12 6.5 16.5 13 20 8.5l-1.4 9.5a1 1 0 0 1-1 .85H6.4a1 1 0 0 1-1-.85L4 8.5Z" />
      <path d="M5.5 15.5h13" />
    </svg>
  );
}

const TIER_ICON: Record<number, React.ReactNode> = {
  1: <BookIcon />,
  2: <WalletIcon />,
  3: <CalculatorIcon />,
  4: <CrownIcon />,
};

/** Editorial subtitles. Descriptive of the tier, not claims about progress. */
const TIER_TAGLINE: Record<number, string> = {
  1: "The trunk — money as it really is",
  2: "Money in the wild",
  3: "The numbers underneath",
  4: "Building your own tools",
};

/* ---------- Page ---------- */

function Library() {
  const { journey, loading } = useJourney();
  const [tab, setTab] = useState<number | "videos">(1);

  // Tiers that actually exist in the database, in order. Derived rather than
  // listed, so a fifth tier (or a tier pulled for rewriting) needs no edit here.
  const tiers = [...new Set(journey.topics.map((t) => t.tier))].sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-[1080px] px-8 pb-24 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Loading the library…
          </p>
        </main>
      </div>
    );
  }

  const activeTierTopics =
    tab === "videos" ? [] : journey.topics.filter((t) => t.tier === tab);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1080px] px-8 pb-24 pt-10">
        <header className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            The Library
          </p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.05] tracking-tight text-ink">
            Every lesson, in a straight line.
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
            The same lessons as your journey — just easier to scan. Unlocked
            ones open where you left off; locked ones stay visible so you can
            see what's coming.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-10 flex flex-wrap items-center gap-1 border-b border-border/70">
          {tiers.map((tier) => (
            <TabButton
              key={tier}
              active={tab === tier}
              onClick={() => setTab(tier)}
              label={TIER_NAME[tier] ?? `Tier ${tier}`}
            />
          ))}
          <span className="mx-2 h-4 w-px bg-border/70" />
          <TabButton active={tab === "videos"} onClick={() => setTab("videos")} label="Videos" />
        </div>

        {tab === "videos" ? (
          <VideosList topics={journey.topics} />
        ) : (
          <TierSection tier={tab} topics={activeTierTopics} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px px-3 py-2.5 text-[13.5px] transition-colors ${
        active ? "text-forest" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-2 -bottom-px h-[1.5px] bg-forest" />}
    </button>
  );
}

/* ---------- Tier view ---------- */

function TierSection({ tier, topics }: { tier: number; topics: JourneyTopic[] }) {
  const [open, setOpen] = useState(true);

  const subtopics = topics.flatMap((t) => t.subtopics);
  // "Unlocked" here means "you could open it right now" — complete or
  // available. That is the honest reading of the word, and it is computed from
  // the same statuses the Topic page draws its padlocks from.
  const unlockedCount = subtopics.filter((s) => s.status !== "locked").length;
  const completedCount = subtopics.filter((s) => s.status === "complete").length;

  if (topics.length === 0) {
    return (
      <p className="py-10 text-[14.5px] text-muted-foreground">
        No lessons have been written for this tier yet.
      </p>
    );
  }

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 border-b border-border/70 py-5 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-forest">
          {TIER_ICON[tier]}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Tier {toRoman(tier)}
            </span>
            <h2 className="font-display text-[24px] tracking-tight text-ink">
              {TIER_NAME[tier] ?? `Tier ${tier}`}
            </h2>
          </div>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {TIER_TAGLINE[tier]} · {unlockedCount}/{subtopics.length} unlocked ·{" "}
            {completedCount} done
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-2">
          {topics.map((topic) => (
            <div key={topic.id} className="mb-8">
              <div className="flex items-baseline gap-3 border-b border-border/40 pb-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  {toRoman(topic.tier)}.{toRoman(topic.order)}
                </span>
                <Link
                  to={`/topic/${topic.id}`}
                  className="text-[15px] text-ink transition-colors hover:text-forest"
                >
                  {topic.title}
                </Link>
              </div>
              <ol>
                {topic.subtopics.map((sub) => (
                  <SubRow key={sub.id} topic={topic} sub={sub} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SubRow({
  topic,
  sub,
}: {
  topic: JourneyTopic;
  sub: JourneyTopic["subtopics"][number];
}) {
  const locked = sub.status === "locked";
  const roman = `${toRoman(topic.tier)}.${toRoman(topic.order)}.${toRoman(sub.order)}`;

  const label = (
    <>
      <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {roman}
      </span>
      <span className={`flex-1 text-[15.5px] ${locked ? "text-muted-foreground/60" : "text-ink"}`}>
        {sub.title}
      </span>
    </>
  );

  if (locked) {
    return (
      <li className="flex cursor-not-allowed items-center gap-4 border-b border-border/50 py-4 opacity-70">
        {label}
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          Locked
        </span>
      </li>
    );
  }

  return (
    <li>
      {/* The exact link the Topic page uses. A bare /lesson (what this used to
          be) has no idea which subtopic it is meant to show. */}
      <Link
        to={`/lesson?topic=${topic.id}&subtopic=${sub.id}`}
        className="group flex items-center gap-4 border-b border-border/60 py-4 transition-colors hover:bg-forest/5"
      >
        {label}
        {sub.status === "complete" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest/80">
            Done
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12.5px] text-forest opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </li>
  );
}

/* ---------- Videos view ---------- */

/**
 * Videos are topic-level (Lesson.tsx opens a topic with one video, then works
 * through that topic's subtopics), so this lists topics, not subtopics — the
 * old version listed twenty per-subtopic videos that were never planned to
 * exist, each with an invented runtime from a five-item array.
 *
 * None are recorded. Rather than hide the tab, it shows the real running
 * order with an honest state on each row: this is what is coming, and a
 * student can still open the written lesson today.
 */
function VideosList({ topics }: { topics: JourneyTopic[] }) {
  const withContent = topics.filter((t) => t.hasContent);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] tracking-tight text-ink">All videos</h2>
        <span className="text-[12.5px] text-muted-foreground">
          {withContent.length} planned · none recorded yet
        </span>
      </div>

      <div className="mb-8 rounded-xl border border-border/70 bg-card/40 px-5 py-4">
        <p className="text-[14px] leading-[1.6] text-muted-foreground">
          The videos are still being made. Every lesson below is fully readable
          without one — the slides and questions are the lesson; the video is a
          short introduction to the topic that will be added on top.
        </p>
      </div>

      <ul>
        {withContent.map((topic) => (
          <VideoRow key={topic.id} topic={topic} />
        ))}
      </ul>
    </section>
  );
}

function VideoRow({ topic }: { topic: JourneyTopic }) {
  const locked = topic.status === "locked";

  const inner = (
    <>
      <VideoThumb />
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] ${locked ? "text-muted-foreground/60" : "text-ink"}`}>
          {topic.title}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          {toRoman(topic.tier)}.{toRoman(topic.order)} · {TIER_NAME[topic.tier] ?? `Tier ${topic.tier}`}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        Not recorded yet
      </span>
      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
      ) : (
        <span className="shrink-0 text-[12.5px] text-forest">Read it</span>
      )}
    </>
  );

  // Locked stays locked even though there is no video to protect — the lock is
  // about the lesson behind the row, and it has to agree with the tree.
  if (locked) {
    return (
      <li className="flex cursor-not-allowed items-center gap-4 border-b border-border/60 py-3 opacity-70">
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={`/topic/${topic.id}`}
        className="flex items-center gap-4 border-b border-border/60 py-3 transition-colors hover:bg-forest/5"
      >
        {inner}
      </Link>
    </li>
  );
}

/**
 * The placeholder thumbnail. Deliberately the same for every row and visibly
 * empty — a play button here would promise something no row can deliver.
 */
function VideoThumb() {
  return (
    <div className="relative flex h-14 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-border/70 bg-muted/30">
      <svg viewBox="0 0 96 56" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d="M0 46 C 20 40, 30 44, 48 38 S 78 32, 96 36 L 96 56 L 0 56 Z"
          fill="var(--muted-foreground)"
          opacity="0.1"
        />
        <path
          d="M18 46 C 22 34, 30 30, 30 22"
          stroke="var(--muted-foreground)"
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
        <ellipse
          cx="30"
          cy="21"
          rx="3"
          ry="1.4"
          transform="rotate(-30 30 21)"
          fill="var(--muted-foreground)"
          opacity="0.45"
        />
      </svg>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-muted-foreground/70">
        <Film className="h-3 w-3" />
      </span>
    </div>
  );
}

export default Library;
