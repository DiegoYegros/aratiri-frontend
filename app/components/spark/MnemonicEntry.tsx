"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

const WORD_PATTERN = /^[a-z]{3,}$/;

export const MnemonicEntry = ({
  onContinue,
  busy = false,
}: {
  onContinue: (phrase: string) => void;
  busy?: boolean;
}) => {
  const t = useTranslation();
  const [wordCount, setWordCount] = useState(12);
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const inputRef = (index: number) => (el: HTMLInputElement | null) => {
    refs.current[index] = el;
  };

  const setWord = (index: number, value: string) => {
    const next = [...words];
    next[index] = value.toLowerCase();
    setWords(next);
  };

  const setCount = (count: 12 | 24) => {
    setWordCount(count);
    setWords((prev) =>
      Array.from({ length: count }, (_, i) => prev[i] ?? "")
    );
  };

  const errors = useMemo(
    () =>
      words.map((w) => (w.length === 0 ? null : !WORD_PATTERN.test(w))),
    [words]
  );

  const anyEmpty = words.slice(0, wordCount).some((w) => w.length === 0);

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (index + 1 < wordCount) {
        refs.current[index + 1]?.focus();
      }
    }
    if (e.key === "Backspace" && words[index] === "" && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const continueWithPhrase = () => {
    const phrase = words.slice(0, wordCount).join(" ");
    onContinue(phrase);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {t("Enter your backup phrase. Words are lower-case letters only.")}
        </p>
        <div className="flex rounded-lg border border-panel-edge overflow-hidden">
          {([12, 24] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setCount(count)}
              aria-pressed={wordCount === count}
              className={`min-h-11 px-4 text-sm font-semibold transition-colors ${
                wordCount === count
                  ? "bg-accent-subtle text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {words.slice(0, wordCount).map((word, index) => (
          <li key={index} className="flex items-center gap-1">
            <span className="text-muted tabular-nums w-6 shrink-0 text-right text-sm">
              {index + 1}.
            </span>
            <input
              ref={inputRef(index)}
              value={word}
              onChange={(e) => setWord(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData
                  .getData("text")
                  .trim()
                  .toLowerCase()
                  .split(/\s+/)
                  .filter(Boolean);
                const next = [...words];
                pasted.forEach((w, i) => {
                  if (index + i < next.length) next[index + i] = w;
                });
                setWords(next);
                const lastIndex = Math.min(index + pasted.length, next.length - 1);
                refs.current[lastIndex]?.focus();
              }}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-label={`${t("Word")} ${index + 1}`}
              aria-invalid={errors[index] === true || undefined}
              className={`min-h-11 w-full px-2 rounded-lg border bg-panel font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-colors ${
                errors[index]
                  ? "border-danger"
                  : "border-panel-edge focus:border-accent"
              }`}
            />
          </li>
        ))}
      </ol>

      {errors.some(Boolean) && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {t("Each word must be lower-case letters (no spaces or symbols).")}
        </p>
      )}

      <button
        type="button"
        onClick={continueWithPhrase}
        disabled={anyEmpty || busy}
        className="mt-6 w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
      >
        {busy ? t("Checking phrase...") : t("Continue")}
      </button>
    </div>
  );
};
