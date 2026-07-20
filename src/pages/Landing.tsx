import { Link } from "react-router-dom";
import { ArrowUpRight, ImageIcon, Mail } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

function Landing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNav />

      {/* ─────────────── HERO ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 pb-8 pt-16">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>An introduction</span>
          <span className="h-px w-8 bg-border" />
          <span>MMXXVI</span>
        </div>

        <div className="relative mt-10">
          <TwigWordmark />
        </div>

        <p className="mt-10 max-w-xl font-display text-[22px] italic leading-[1.5] tracking-[-0.01em] text-muted-foreground">
          A calm, field-guide approach to money — grown one small lesson at a
          time.
        </p>
      </section>

      {/* ─────────────── DEFINITION ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 py-20">
        <div className="grid grid-cols-12 gap-16">
          <div className="col-span-12 lg:col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              I &nbsp;·&nbsp; The word
            </div>
            <h2 className="mt-6 font-display text-[46px] font-normal leading-[1.02] tracking-[-0.03em]">
              sprig
              <span className="ml-3 align-middle font-sans text-[13px] font-normal uppercase tracking-[0.22em] text-muted-foreground">
                / sprɪɡ / &nbsp;noun
              </span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <p className="max-w-[62ch] font-display text-[26px] font-normal leading-[1.35] tracking-[-0.015em] text-foreground">
              A small shoot from a plant — the very first sign of something
              that, given time and light and a little patience, grows into
              something much bigger.
            </p>
            <div className="mt-10 h-px w-16 bg-forest/50" />
            <p className="mt-10 max-w-[58ch] text-[15.5px] leading-[1.8] text-muted-foreground">
              Financial understanding works the same way. It doesn't arrive
              fully formed. It begins as a single idea — a choice noticed, a
              habit questioned, a number understood — and grows outward from
              there. Sprig is a place to plant that first shoot, and to tend
              it, one short lesson at a time.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ─────────────── WHAT SPRIG IS ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 py-24">
        <div className="grid grid-cols-12 gap-16">
          <div className="col-span-12 lg:col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              II &nbsp;·&nbsp; What Sprig is
            </div>
            <h2 className="mt-6 font-display text-[46px] font-normal leading-[1.02] tracking-[-0.03em]">
              A free field guide,
              <br />
              <em className="font-normal italic text-forest">not a textbook.</em>
            </h2>
            <p className="mt-8 max-w-sm text-[14.5px] leading-[1.8] text-muted-foreground">
              Sprig is a free, interactive financial literacy platform made for
              UK students aged{" "}
              <span className="text-foreground">13–14 (Year 8–9)</span>. No
              exams. No jargon. Short lessons and real scenarios, drawn from
              real life.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <div className="grid grid-cols-1 gap-y-10 md:grid-cols-2 md:gap-x-14">
              <Pillar
                marker="I"
                title="Essentials"
                body="The trunk. Everyone begins here — the psychology of spending, where money really comes from, how banks work, and setting goals that actually matter."
                accent
              />
              <Pillar
                marker="II"
                title="Application"
                body="Budgeting, pricing tricks, subscriptions, Buy Now Pay Later, and staying safe from scams. Money as it shows up in daily life."
              />
              <Pillar
                marker="III"
                title="Mathematics"
                body="Percentages, simple and compound interest, inflation, and risk — the numbers underneath every financial decision, made intuitive."
              />
              <Pillar
                marker="IV"
                title="Mastery"
                body="Building a budget calculator in Python, present and future value, behavioural finance, and an introduction to crypto — for those who want to go further."
              />
            </div>

            <p className="mt-14 max-w-[60ch] text-[14px] leading-[1.85] text-muted-foreground">
              Everyone completes the essentials first. After that, students
              choose which branch to grow into — and can return for the others
              whenever they like.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ─────────────── ABOUT ME ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 py-24">
        <div className="grid grid-cols-12 gap-16">
          <div className="col-span-12 lg:col-span-5">
            <div
              className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-border bg-[color:var(--paper)]"
              aria-label="Portrait placeholder"
            >
              {/* Subtle botanical corner marks */}
              <svg
                className="absolute left-4 top-4 text-forest/25"
                width="34"
                height="34"
                viewBox="0 0 34 34"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 32 C 10 24, 18 18, 30 6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse
                  cx="29"
                  cy="7"
                  rx="3"
                  ry="1.6"
                  transform="rotate(-40 29 7)"
                  fill="currentColor"
                />
              </svg>
              <svg
                className="absolute bottom-4 right-4 rotate-180 text-forest/25"
                width="34"
                height="34"
                viewBox="0 0 34 34"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 32 C 10 24, 18 18, 30 6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse
                  cx="29"
                  cy="7"
                  rx="3"
                  ry="1.6"
                  transform="rotate(-40 29 7)"
                  fill="currentColor"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/70">
                <ImageIcon className="h-6 w-6" strokeWidth={1.2} />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em]">
                  photo
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              III &nbsp;·&nbsp; About me
            </div>
            <h2 className="mt-6 font-display text-[46px] font-normal leading-[1.02] tracking-[-0.03em]">
              Hello — I'm a UK student,
              <br />
              <em className="font-normal italic text-forest">and I built Sprig.</em>
            </h2>

            <div className="mt-10 space-y-6 text-[15.5px] leading-[1.85] text-muted-foreground">
              <p>
                I grew up in the UK and, like most people my age, was never
                really taught how money works. Not properly. Not the psychology
                of it, not how banks actually run, not why interest matters —
                nothing you could hold on to.
              </p>
              <p>
                I built Sprig for the students coming after me. The goal is
                simple: make financial understanding something young people
                actually get to have, in a form that feels calm and honest
                rather than scary or salesy.
              </p>
              <p>
                I work directly with schools, teachers, and organisations who
                want to bring financial literacy to more students — quietly,
                thoughtfully, and without cost to families.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── TRUST ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 pb-10 pt-6">
        <div className="rounded-[20px] border border-forest/25 bg-forest/[0.04] px-8 py-8 md:px-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-forest">
              A quiet promise
            </div>
            <ul className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-3">
              <TrustItem
                heading="Fully anonymous"
                body="Students never give real names. Nicknames only — always."
              />
              <TrustItem
                heading="Built with teachers"
                body="Every lesson is shaped alongside UK educators who work with this age group."
              />
              <TrustItem
                heading="No data sold"
                body="Nothing about a student is ever sold, shared, or handed to advertisers."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ─────────────── CONTACT ─────────────── */}
      <section className="mx-auto max-w-[1240px] px-10 py-24">
        <div className="grid grid-cols-12 gap-16">
          <div className="col-span-12 lg:col-span-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              IV &nbsp;·&nbsp; Get in touch
            </div>
            <h2 className="mt-6 font-display text-[46px] font-normal leading-[1.02] tracking-[-0.03em]">
              Say hello.
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <p className="max-w-[54ch] text-[16px] leading-[1.8] text-muted-foreground">
              If you're a teacher, parent, or school interested in bringing
              Sprig to more students — or you simply have a question — I'd love
              to hear from you.
            </p>

            <a
              href="mailto:hello@sprig.study"
              className="group mt-10 inline-flex items-center gap-4"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5">
                <Mail className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Write to
                </span>
                <span className="block font-display text-[26px] italic tracking-[-0.01em] text-foreground group-hover:text-forest">
                  hello@sprig.study
                </span>
              </span>
              <ArrowUpRight className="ml-2 h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest" />
            </a>

            <div className="mt-16">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground hover:text-forest"
              >
                <span className="h-px w-8 bg-current" />
                See the journey
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
          <span>Ed. 03 · Winter</span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Components ─────────────── */

function Divider() {
  return (
    <div className="mx-auto max-w-[1240px] px-10">
      <div className="h-px w-full bg-border" />
    </div>
  );
}

function Pillar({
  marker,
  title,
  body,
  accent,
}: {
  marker: string;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div className="relative pl-8">
      <span
        className={`absolute left-0 top-1 font-display text-[18px] italic ${
          accent ? "text-terracotta" : "text-forest/70"
        }`}
      >
        {marker}
      </span>
      <h3 className="font-display text-[26px] leading-[1.1] tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.8] text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function TrustItem({ heading, body }: { heading: string; body: string }) {
  return (
    <li>
      <div className="font-display text-[19px] tracking-[-0.01em] text-foreground">
        {heading}
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.75] text-muted-foreground">
        {body}
      </p>
    </li>
  );
}

/* ─────────────── Twig Wordmark Hero ─────────────── */

function TwigWordmark() {
  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1200 340"
        className="block h-auto w-full"
        aria-label="Sprig — a hand-drawn twig with the word Sprig written across it"
      >
        <defs>
          <style>{`
            .twig-shadow { stroke: var(--sage); opacity: 0.55; }
            .twig-main   { stroke: var(--forest); }
            .leaf-shadow { fill: var(--sage); opacity: 0.5; }
            .leaf-main   { fill: var(--forest); }
            .leaf-accent { fill: var(--terracotta); opacity: 0.85; }
          `}</style>
        </defs>

        {/* Depth layer — offset, lighter twig */}
        <g transform="translate(10, 14)">
          <path
            className="twig-shadow"
            d="M 40 210 C 180 190, 340 205, 520 195 C 700 185, 880 210, 1060 190 C 1110 184, 1140 178, 1170 170"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          {/* small offshoots */}
          <path className="twig-shadow" d="M 320 200 C 310 160, 305 130, 315 90" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path className="twig-shadow" d="M 780 200 C 800 240, 820 270, 850 290" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* shadow leaves */}
          <ellipse className="leaf-shadow" cx="315" cy="85" rx="26" ry="12" transform="rotate(-40 315 85)" />
          <ellipse className="leaf-shadow" cx="850" cy="295" rx="24" ry="11" transform="rotate(25 850 295)" />
          <ellipse className="leaf-shadow" cx="1170" cy="168" rx="28" ry="12" transform="rotate(-15 1170 168)" />
        </g>

        {/* Main twig */}
        <g>
          <path
            className="twig-main"
            d="M 30 200 C 170 180, 330 195, 510 185 C 690 175, 870 200, 1050 180 C 1100 174, 1130 168, 1160 160"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
          {/* offshoots */}
          <path className="twig-main" d="M 200 190 C 190 150, 180 120, 190 80" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path className="twig-main" d="M 420 188 C 400 220, 385 250, 380 285" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path className="twig-main" d="M 700 182 C 720 145, 735 115, 740 80" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path className="twig-main" d="M 960 188 C 980 225, 990 255, 985 290" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* leaves */}
          <ellipse className="leaf-main" cx="190" cy="76" rx="26" ry="12" transform="rotate(-45 190 76)" />
          <ellipse className="leaf-main" cx="380" cy="290" rx="22" ry="10" transform="rotate(30 380 290)" />
          <ellipse className="leaf-accent" cx="742" cy="76" rx="28" ry="13" transform="rotate(-30 742 76)" />
          <ellipse className="leaf-main" cx="985" cy="295" rx="24" ry="11" transform="rotate(28 985 295)" />
          <ellipse className="leaf-main" cx="1160" cy="158" rx="30" ry="13" transform="rotate(-15 1160 158)" />

          {/* tiny buds along twig */}
          <circle cx="90" cy="196" r="3" fill="var(--forest)" />
          <circle cx="560" cy="184" r="2.5" fill="var(--forest)" />
          <circle cx="880" cy="192" r="3" fill="var(--terracotta)" opacity="0.85" />
        </g>

        {/* Wordmark laid across the twig */}
        <text
          x="600"
          y="215"
          textAnchor="middle"
          className="fill-[color:var(--ink)]"
          style={{
            fontFamily: 'Fraunces, ui-serif, Georgia, serif',
            fontSize: '180px',
            fontStyle: 'italic',
            fontWeight: 500,
            letterSpacing: '-0.04em',
          }}
        >
          Sprig
        </text>
      </svg>
    </div>
  );
}

export default Landing;
