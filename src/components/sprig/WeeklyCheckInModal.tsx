import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { WeeklyCheckinInput } from "@/hooks/useWeeklyCheckin";

const COMPLETION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Not really" },
  { value: 1, label: "Some" },
  { value: 2, label: "Yes, all" },
];

export function WeeklyCheckInModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: WeeklyCheckinInput) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [confidence, setConfidence] = useState<number | null>(null);
  const [completion, setCompletion] = useState<number | null>(null);
  const [confusedBy, setConfusedBy] = useState("");
  const [likedMost, setLikedMost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setConfidence(null);
        setCompletion(null);
        setConfusedBy("");
        setLikedMost("");
        setError(null);
        setSubmitted(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = confidence !== null && completion !== null && !submitting;

  const handleSubmit = async () => {
    if (confidence === null || completion === null) return;
    setSubmitting(true);
    setError(null);

    const result = await onSubmit({ confidence, completion, confusedBy, likedMost });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmitted(true);
    setTimeout(onClose, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Weekly check-in"
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
              Weekly check-in
            </div>
            <h2 className="mt-3 font-display text-[28px] font-normal leading-[1.15] tracking-[-0.02em]">
              How did this <em className="italic text-forest">week</em> go?
            </h2>

            <div className="mt-7">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                How confident are you feeling?
              </span>
              <div className="mt-3 flex items-center justify-between gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <PillButton
                    key={n}
                    label={String(n)}
                    selected={confidence === n}
                    onSelect={() => setConfidence(n)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Did you finish this week's lessons?
              </span>
              <div className="mt-3 flex items-center justify-between gap-2">
                {COMPLETION_OPTIONS.map((opt) => (
                  <PillButton
                    key={opt.value}
                    label={opt.label}
                    selected={completion === opt.value}
                    onSelect={() => setCompletion(opt.value)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <textarea
                value={confusedBy}
                onChange={(e) => setConfusedBy(e.target.value)}
                rows={2}
                placeholder="Anything that confused you? (optional)"
                className="w-full resize-none rounded-xl border border-border bg-card/40 px-4 py-3 text-[16px] leading-[1.6] text-foreground placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
              />
            </div>

            <div className="mt-4">
              <textarea
                value={likedMost}
                onChange={(e) => setLikedMost(e.target.value)}
                rows={2}
                placeholder="What was most useful? (optional)"
                className="w-full resize-none rounded-xl border border-border bg-card/40 px-4 py-3 text-[16px] leading-[1.6] text-foreground placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="mt-4 text-[13px] text-[color:var(--destructive)]">
                {error}
              </p>
            )}

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
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:translate-y-0"
              >
                {submitting ? "Saving…" : "Submit"}
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

function PillButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-1 items-center justify-center rounded-xl border px-2 py-3 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors ${
        selected
          ? "border-forest bg-forest/10 text-forest"
          : "border-border text-foreground/70 hover:border-forest/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
