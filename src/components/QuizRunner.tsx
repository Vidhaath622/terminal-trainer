"use client";

/**
 * QuizRunner: student-facing quiz/assignment form with instant grading.
 * Uses the sanitized quiz (no answers) from the teacher catalog.
 */
import { useMemo, useState } from "react";
import { gradeQuiz, type Quiz, type StudentAnswer } from "@/roles/quiz";
import { sanitizeQuizForStudent } from "@/roles/quiz";

/** Difficulty badge colours — the same easy/medium/hard palette as the problem cards. */
const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "border-term-green/40 text-term-green",
  medium: "border-term-yellow/40 text-term-yellow",
  hard: "border-term-red/40 text-term-red",
};

export default function QuizRunner({ quiz, onSubmit }: { quiz: Quiz; onSubmit?: (earned: number, max: number) => void }) {
  const clean = useMemo(() => sanitizeQuizForStudent(quiz), [quiz]);
  const [answers, setAnswers] = useState<StudentAnswer>({});
  const [result, setResult] = useState<{ earned: number; max: number; results: { questionId: string; correct: boolean; marks: number }[] } | null>(null);

  const submit = () => {
    const r = gradeQuiz(quiz, answers);
    setResult(r);
    onSubmit?.(r.earned, r.max);
  };

  return (
    <div className="space-y-4" data-testid="quiz-runner">
      <div>
        <h2 className="text-lg font-semibold">{clean.title}</h2>
        {clean.instructions && <p className="text-xs text-term-text/60">{clean.instructions}</p>}
        <span className="font-mono text-[10px] uppercase text-term-text/50">{clean.kind}</span>
      </div>

      {clean.questions.map((q, idx) => {
        const qr = result?.results.find((r) => r.questionId === q.id);
        return (
          <div key={q.id} className="rounded border border-term-border bg-term-panel p-3" data-testid={`question-${idx}`}>
            <p className="text-sm">
              <span className="mr-1 font-mono text-term-text/50">Q{idx + 1}.</span>
              {q.prompt} <span className="text-term-text/50">({q.marks} mk)</span>
              {q.difficulty && (
                <span
                  className={`ml-1.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${DIFFICULTY_STYLE[q.difficulty]}`}
                >
                  {q.difficulty}
                </span>
              )}
            </p>
            {q.kind === "mcq" ? (
              <div className="mt-2 space-y-1">
                {q.options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                      disabled={result !== null}
                    />
                    {opt.text}
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                className="mt-2 w-full rounded border border-term-border bg-term-bg px-2 py-1 text-sm"
                placeholder="Type your answer…"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                disabled={result !== null}
              />
            )}
            {qr && (
              <p className={`mt-1 text-xs ${qr.correct ? "text-term-green" : "text-term-red"}`}>
                {qr.correct ? "✓ correct" : "✗ incorrect"} ({qr.marks}/{q.marks})
              </p>
            )}
          </div>
        );
      })}

      {!result ? (
        <button
          onClick={submit}
          className="rounded bg-term-green/20 px-4 py-2 text-sm font-semibold text-term-green hover:bg-term-green/30"
          data-testid="quiz-submit"
        >
          Submit answers
        </button>
      ) : (
        <div className="rounded border border-term-border bg-term-panel p-3 text-sm" data-testid="quiz-result">
          Score: <span className="font-mono">{result.earned} / {result.max}</span>{" "}
          {result.earned === result.max ? "🎉" : "— review the flagged questions"}
        </div>
      )}
    </div>
  );
}
