import { useState } from "react";

type BaseQuestion = {
  prompt: string;
  explanation: string;
};

export type McqQuestion = BaseQuestion & {
  question_type: "mcq";
  options: string[];
  correctIndex: number;
};

export type MultiQuestion = BaseQuestion & {
  question_type: "multi";
  options: string[];
  correctIndices: number[];
};

export type NumQuestion = BaseQuestion & {
  question_type: "num";
  correctValue: number;
  // Accepted deviation from correctValue. Null/undefined means an exact match is required.
  tolerance?: number | null;
};

export type TextQuestion = BaseQuestion & {
  question_type: "text";
  acceptedAnswers: string[];
};

export type Question = McqQuestion | MultiQuestion | NumQuestion | TextQuestion;

const inputClasses =
  "w-full rounded-xl border border-border bg-transparent px-5 py-4 text-[15px] leading-[1.55] text-foreground/90 outline-none transition-colors focus:border-forest placeholder:text-muted-foreground/60";

export function QuestionCard({
  question,
  kicker = "Check-in · Question 1 of 1",
  onSubmit,
}: {
  question: Question;
  kicker?: string;
  onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(new Set());
  const [numValue, setNumValue] = useState("");
  const [textValue, setTextValue] = useState("");

  const canSubmit =
    question.question_type === "mcq"
      ? selected !== null
      : question.question_type === "multi"
        ? selectedMulti.size > 0
        : question.question_type === "num"
          ? numValue.trim() !== ""
          : textValue.trim() !== "";

  function handleSubmit() {
    if (question.question_type === "mcq") {
      onSubmit(selected === question.correctIndex);
      return;
    }
    if (question.question_type === "multi") {
      const picked = [...selectedMulti].sort((a, b) => a - b);
      const answer = [...question.correctIndices].sort((a, b) => a - b);
      const correct =
        picked.length === answer.length && picked.every((v, i) => v === answer[i]);
      onSubmit(correct);
      return;
    }
    if (question.question_type === "num") {
      const entered = parseFloat(numValue);
      const correct =
        !Number.isNaN(entered) &&
        (question.tolerance != null
          ? Math.abs(entered - question.correctValue) <= question.tolerance
          : entered === question.correctValue);
      onSubmit(correct);
      return;
    }
    const normalized = textValue.trim().toLowerCase();
    const correct = question.acceptedAnswers.some(
      (a) => a.trim().toLowerCase() === normalized,
    );
    onSubmit(correct);
  }

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        {kicker}
      </div>
      <h2 className="mt-5 font-display text-[32px] font-normal leading-[1.2] tracking-[-0.02em]">
        {question.prompt}
      </h2>

      <div className="mt-10">
        {question.question_type === "mcq" && (
          <OptionsList
            options={question.options}
            isSelected={(i) => selected === i}
            onToggle={(i) => setSelected(i)}
          />
        )}
        {question.question_type === "multi" && (
          <OptionsList
            options={question.options}
            isSelected={(i) => selectedMulti.has(i)}
            onToggle={(i) =>
              setSelectedMulti((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
          />
        )}
        {question.question_type === "num" && (
          <input
            type="number"
            inputMode="decimal"
            value={numValue}
            onChange={(e) => setNumValue(e.target.value)}
            placeholder="Enter a number"
            className={inputClasses}
          />
        )}
        {question.question_type === "text" && (
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Type your answer"
            className={inputClasses}
          />
        )}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="rounded-full bg-terracotta px-7 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--terracotta)_60%,transparent)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0"
        >
          Submit answer
        </button>
      </div>
    </div>
  );
}

function OptionsList({
  options,
  isSelected,
  onToggle,
}: {
  options: string[];
  isSelected: (i: number) => boolean;
  onToggle: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      {options.map((opt, i) => {
        const isSel = isSelected(i);
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            className={`group flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
              isSel ? "border-forest bg-forest/[0.06]" : "border-border hover:border-forest/40"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                isSel ? "border-forest bg-forest text-primary-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-[15px] leading-[1.55] text-foreground/90">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
