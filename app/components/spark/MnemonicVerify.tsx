"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

const CHALLENGE_POSITIONS = [4, 7, 10];

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

interface Challenge {
  position: number;
  correct: string;
  options: string[];
}

const buildChallenges = (words: string[]): Challenge[] =>
  CHALLENGE_POSITIONS.map((position) => {
    const correct = words[position - 1];
    const pool = [...new Set(words.filter((_, i) => i !== position - 1))].slice(
      0,
      3
    );
    return {
      position,
      correct,
      options: shuffle([correct, ...pool]),
    };
  });

export const MnemonicVerify = ({
  mnemonic,
  onVerified,
}: {
  mnemonic: string;
  onVerified: () => void;
}) => {
  const t = useTranslation();
  const words = mnemonic.trim().split(/\s+/);
  const [challenges] = useState<Challenge[]>(() => buildChallenges(words));
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const challenge = challenges[current];

  const pick = (option: string) => {
    if (option === challenge.correct) {
      setError(null);
      if (current + 1 < challenges.length) {
        setCurrent(current + 1);
      } else {
        onVerified();
      }
    } else {
      setError(t("That's not the word at position {position}. Try again.", {
        position: String(challenge.position),
      }));
    }
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        {t("Pick the word at position {position} of your backup phrase.", {
          position: String(challenge.position),
        })}
      </p>
      <p aria-live="polite" className="text-center font-mono text-xl mb-5">
        {challenge.position}.
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("Verify backup phrase")}>
        {challenge.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            className="min-h-11 px-3 py-2 font-mono rounded-lg border border-panel-edge bg-panel-elevated hover:border-accent hover:text-accent transition-colors touch-manipulation break-words"
          >
            {option}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger text-center">
          {error}
        </p>
      )}
    </div>
  );
};
