import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

import { CheckInModal } from "@/components/sprig/CheckInModal";
import { JourneyTree } from "@/components/sprig/JourneyTree";

function Dashboard() {
  const [checkInOpen, setCheckInOpen] = useState(false);

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
                className="absolute inset-y-0 left-0 rounded-full bg-forest"
                style={{ width: "13%" }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              13%
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-forest/50 hover:text-forest"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-forest" />
            How did today go?
          </button>

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

            {/* Editorial stats */}
            <dl className="mt-8 grid grid-cols-2 gap-y-7">
              <MetaStat label="Tier" value="Essentials" />
              <MetaStat label="Chapter" value="I of IV" />
              <MetaStat label="Streak" value="12" suffix="days" />
              <MetaStat label="Experience" value="2,480 / 12,000" suffix="xp" />
              <MetaStat label="Next" value="Banks" accent />
            </dl>


            <div className="mt-10 h-px w-full bg-border" />

            <button className="group mt-8 inline-flex items-center gap-3 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Continue reading
                </span>
                <span className="block text-[15px] font-medium text-foreground">
                  I.IV &nbsp;How banks actually work
                </span>

              </span>
            </button>

            <p className="mt-10 max-w-xs font-mono text-[10.5px] uppercase leading-[1.9] tracking-[0.22em] text-muted-foreground/80">
              Read bottom &nbsp;→&nbsp; top
              <br />
              Twig · Trunk · Branch · Leaf
            </p>
          </div>
        </aside>

        {/* Right column: reserved for future journey visualization */}
        <section className="col-span-12 lg:col-span-8">
          <JourneyTree />
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
          <span>V1</span>
        </div>
      </footer>

      <CheckInModal open={checkInOpen} onClose={() => setCheckInOpen(false)} />
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
