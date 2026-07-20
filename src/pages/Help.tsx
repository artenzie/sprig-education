import { useState } from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

type QA = { q: string; a: string };
type Section = { id: string; title: string; items: QA[] };

const SECTIONS: Section[] = [
  {
    id: "general",
    title: "General",
    items: [
      {
        q: "What is Sprig?",
        a: "Sprig is a calm, plain-English way to learn about money — built for students in Year 8 and 9. You grow a little each lesson, from spotting spending traps to understanding how banks and interest actually work.",
      },
      {
        q: "Is it free?",
        a: "Yes. Sprig is completely free to use. There's no premium tier, no hidden paywall, and no ads. It exists because everyone your age should have a fair shot at understanding money — not just people whose families already talk about it.",
      },
      {
        q: "Do I need to make an account?",
        a: "You'll log in with a nickname and PIN that your teacher or parent gives you. You never enter your real name, email, or anything personal — the account is just there so your progress saves between sessions.",
      },
      {
        q: "Who made Sprig?",
        a: "Sprig is built by Artem Makarov, a UK student, with input from teachers who work with this age group. It's a small, independent project — not a company trying to sell you anything.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Safety",
    items: [
      {
        q: "Does Sprig know my real name?",
        a: "No. Sprig only ever sees your nickname. Your teacher or parent holds the list that connects your nickname to you in the real world — Sprig itself does not.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. The only things stored are your nickname, your PIN (encrypted), and your progress through lessons. Nothing is sold, shared with advertisers, or handed to third parties. Ever.",
      },
      {
        q: "What happens to my information if I stop using Sprig?",
        a: "You (or your teacher) can ask for your account and progress to be deleted at any time, and it's gone. No archives, no marketing lists.",
      },
      {
        q: "Can other students see how I'm doing?",
        a: "No. Your progress, scores, and missed questions are only visible to you. Teachers can see class-wide patterns but never individual answers tied to a real name.",
      },
    ],
  },
  {
    id: "how",
    title: "How the app works",
    items: [
      {
        q: "How does the learning path work?",
        a: "The trunk of your tree is the Essentials — the five lessons everyone does first. Once you finish those, you can branch out into Application, Mathematics, or Mastery, depending on what interests you.",
      },
      {
        q: "What happens if I get a question wrong?",
        a: "Nothing bad. Your sprig still grows — the point is thinking through the idea, not being right first time. Wrong answers get a gentle explanation and quietly show up later in your 'Worth another look' cards so you can revisit them.",
      },
      {
        q: "Can I redo a lesson?",
        a: "Yes. Any lesson you've completed is always available to replay from the Library. Doing a lesson again doesn't reset your progress — it just lets you refresh what you learned.",
      },
      {
        q: "What if I get stuck on something?",
        a: "Every lesson has short info slides you can flick back through before the questions. If something still doesn't click, use the box at the top of this page to send a question directly.",
      },
    ],
  },
  {
    id: "progress",
    title: "Progress & Tests",
    items: [
      {
        q: "What's the difference between a Progress Check and a Growth Check?",
        a: "A Progress Check is a short test on topics you pick — useful for revisiting a specific idea. A Growth Check is broader: it covers everything you've learned so far, and it's how the graph on your Growth page tracks your overall understanding over time.",
      },
      {
        q: "Do these tests affect my school grade?",
        a: "No. Nothing on Sprig is a real exam. The checks are just for you (and, in a soft way, your teacher) to see how ideas are landing. There's no pass or fail.",
      },
      {
        q: "What is the certificate for?",
        a: "The certificate marks that you've completed the Essentials tier plus at least one optional tier. It isn't a formal qualification — it's a keepsake, something to be proud of and share with family or a teacher.",
      },
      {
        q: "Why doesn't my sprig shrink when I get a question wrong?",
        a: "Because learning shouldn't punish you for trying. Your sprig grows through the act of doing the lesson, not through getting everything perfect. The missed questions come back gently, later.",
      },
    ],
  },
];

function Help() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-[880px] px-8 pb-32 pt-14">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
            Help · FAQ
          </div>
          <h1 className="mt-3 font-display text-[52px] font-normal leading-[1.02] tracking-[-0.03em]">
            Anything <em className="italic text-forest">unclear?</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-muted-foreground">
            The most common questions are below. If your question isn't here, or
            something in the app isn't working the way you expected, send us a
            note — a real person reads every one.
          </p>
        </div>

        <ContactBox />

        <div className="mt-20 space-y-16">
          {SECTIONS.map((s) => (
            <FaqSection key={s.id} section={s} />
          ))}
        </div>

        <div className="mt-24 border-t border-border pt-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Anonymous · Free · UK · Ages 13–14
          </div>
        </div>
      </main>
    </div>
  );
}

function ContactBox() {
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card/50 p-7">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="font-display text-[24px] font-normal leading-[1.15] tracking-[-0.015em]">
          Still confused, or need help?
        </h2>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:inline">
          We reply within 2 days
        </span>
      </div>
      <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">
        Check the questions below, or reach out to us directly.
      </p>
      <div className="mt-5">
        <textarea
          value={msg}
          onChange={(e) => {
            setMsg(e.target.value);
            if (sent) setSent(false);
          }}
          rows={4}
          placeholder="Type your question or issue here…"
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[14.5px] leading-[1.6] text-foreground placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {sent ? "Sent — thank you" : "Nothing personal required"}
          </span>
          <button
            onClick={() => {
              if (msg.trim().length === 0) return;
              setSent(true);
              setMsg("");
            }}
            disabled={msg.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:translate-y-0"
          >
            Send
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ section }: { section: Section }) {
  return (
    <section>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          {section.id === "general"
            ? "01"
            : section.id === "privacy"
            ? "02"
            : section.id === "how"
            ? "03"
            : "04"}
        </span>
        <h2 className="font-display text-[28px] font-normal leading-[1.15] tracking-[-0.02em]">
          {section.title}
        </h2>
      </div>
      <div className="mt-6 border-t border-border">
        {section.items.map((item, i) => (
          <FaqRow key={i} item={item} />
        ))}
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-forest"
      >
        <span className="font-display text-[19px] font-normal leading-[1.35] tracking-[-0.01em]">
          {item.q}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180 text-forest" : ""
          }`}
        />
      </button>
      <div
        className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="max-w-[68ch] pb-6 pr-8 text-[14.5px] leading-[1.75] text-muted-foreground">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Help;
