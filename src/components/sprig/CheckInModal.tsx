import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Mood = "sad" | "meh" | "happy";

export function CheckInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      // small delay so exit animation isn't jarring
      const t = setTimeout(() => {
        setMood(null);
        setNote("");
        setSubmitted(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!mood) return;
    setSubmitted(true);
    setTimeout(onClose, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Daily check-in"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[440px] rounded-2xl border border-border bg-background p-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {!submitted ? (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Daily check-in
            </div>
            <h2 className="mt-3 font-display text-[28px] font-normal leading-[1.15] tracking-[-0.02em]">
              How did today <em className="italic text-forest">go?</em>
            </h2>

            <div className="mt-7 flex items-center justify-between gap-4">
              <MoodButton
                type="sad"
                label="Rough"
                selected={mood === "sad"}
                onSelect={() => setMood("sad")}
              />
              <MoodButton
                type="meh"
                label="Okay"
                selected={mood === "meh"}
                onSelect={() => setMood("meh")}
              />
              <MoodButton
                type="happy"
                label="Good"
                selected={mood === "happy"}
                onSelect={() => setMood("happy")}
              />
            </div>

            <div className="mt-7">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Anything you want to share? (optional)"
                className="w-full resize-none rounded-xl border border-border bg-card/40 px-4 py-3 text-[14px] leading-[1.6] text-foreground placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!mood}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:translate-y-0"
              >
                Submit
              </button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest/10">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                <path
                  d="M6 13.5 L11 18.5 L20.5 8"
                  stroke="var(--forest)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <h2 className="mt-5 font-display text-[24px] font-normal leading-[1.2] tracking-[-0.02em]">
              Noted — thank you.
            </h2>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              Small check-ins help your sprig grow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodButton({
  type,
  label,
  selected,
  onSelect,
}: {
  type: Mood;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex flex-1 flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-colors ${
        selected
          ? "border-forest bg-forest/10 text-forest"
          : "border-border text-foreground/70 hover:border-forest/40 hover:text-foreground"
      }`}
    >
      <FaceIcon type={type} selected={selected} />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
        {label}
      </span>
    </button>
  );
}

function FaceIcon({ type, selected }: { type: Mood; selected: boolean }) {
  const stroke = selected ? "var(--forest)" : "currentColor";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r="15"
        stroke={stroke}
        strokeWidth="1.4"
        fill="none"
      />
      {/* eyes */}
      <circle cx="15" cy="17.5" r="0.9" fill={stroke} />
      <circle cx="25" cy="17.5" r="0.9" fill={stroke} />
      {/* mouth */}
      {type === "sad" && (
        <path
          d="M14.5 26.5 Q20 22 25.5 26.5"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {type === "meh" && (
        <path
          d="M14.5 25 L25.5 25"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {type === "happy" && (
        <path
          d="M14.5 23 Q20 28.5 25.5 23"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}
