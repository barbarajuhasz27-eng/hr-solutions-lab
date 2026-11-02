"use client";

import { CheckCircle2, ListChecks, Lock, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import type { Viewer } from "@/lib/access";
import { hasPassedQuiz, isCorrectAnswer, scoreQuiz } from "@/lib/learning";
import { learningActions } from "@/lib/use-learning";
import type { LearningAssignment, Quiz } from "@/types/learning";

type Phase = "intro" | "question" | "result";

/**
 * Runs a module quiz one question at a time with immediate feedback after each answer.
 * The attempt is saved when the last question has been answered.
 */
export function QuizRunner({
  quiz,
  assignment,
  viewer,
  unlocked,
}: {
  quiz: Quiz;
  assignment: LearningAssignment;
  viewer: Viewer;
  unlocked: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (phase !== "intro") headingRef.current?.focus();
  }, [phase, index]);

  const question = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;
  const passedBefore = hasPassedQuiz(assignment);
  const passedOn = assignment.quizResults.find((r) => r.passed)?.attemptedAt;

  const start = () => {
    setPhase("question");
    setIndex(0);
    setAnswers({});
    setSelected(null);
    setChecked(false);
  };

  const check = () => {
    if (!selected) return;
    setAnswers((prev) => ({ ...prev, [question.id]: selected }));
    setChecked(true);
  };

  const next = () => {
    if (isLast) {
      learningActions.submitQuiz(viewer, assignment.id, answers);
      setPhase("result");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setChecked(false);
  };

  if (!unlocked) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong bg-subtle p-5">
        <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
        <div>
          <h2 className="text-base font-semibold text-ink">Quiz locked</h2>
          <p className="mt-1 text-sm text-muted">Read every lesson first. The quiz then opens here.</p>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Quiz</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Check what you have learned</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
          <li>{quiz.questions.length} questions, one at a time, with feedback after each answer.</li>
          <li>
            Pass mark: <strong className="font-semibold text-ink">{quiz.passMark}%</strong>. You can retry as often as you like.
          </li>
        </ul>
        {passedBefore && passedOn ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            You passed on {formatDate(passedOn)}. You can take it again for practice; your completion is kept.
          </p>
        ) : null}
        {assignment.quizResults.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Your attempts</h3>
            <ol className="mt-1.5 divide-y divide-line rounded-lg border border-line text-sm">
              {assignment.quizResults.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-ink-soft">
                    Attempt {i + 1} · <time dateTime={r.attemptedAt}>{formatDate(r.attemptedAt)}</time>
                  </span>
                  <span className={cn("font-medium tabular-nums", r.passed ? "text-emerald-700" : "text-ink-soft")}>
                    {r.score}% · {r.passed ? "Passed" : "Not passed"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <Button className="mt-5" onClick={start}>
          <ListChecks aria-hidden />
          {assignment.quizResults.length === 0 ? "Start quiz" : passedBefore ? "Practise again" : "Retry quiz"}
        </Button>
      </div>
    );
  }

  if (phase === "result") {
    const result = scoreQuiz(quiz, answers);
    return (
      <div role="status" aria-live="polite">
        <span
          aria-hidden
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            result.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
          )}
        >
          {result.passed ? <Trophy className="size-6" /> : <RotateCcw className="size-6" />}
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-xl font-semibold text-ink outline-none">
          {result.passed ? "Quiz passed" : "Not passed yet"}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          You scored <strong className="font-semibold text-ink">{result.score}%</strong> ({result.correct} of {result.total}{" "}
          correct). The pass mark is {quiz.passMark}%.
        </p>
        <p className="mt-2 text-sm text-muted">
          {result.passed
            ? "Well done. Your result is saved."
            : "Have another look at the lessons and try again whenever you are ready. There is no limit on attempts."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {result.passed ? null : (
            <Button onClick={start}>
              <RotateCcw aria-hidden />
              Retry quiz
            </Button>
          )}
          <ButtonLink href="/me/learning" variant={result.passed ? "primary" : "secondary"}>
            Back to Learning Center
          </ButtonLink>
        </div>
      </div>
    );
  }

  const correct = checked && selected ? isCorrectAnswer(quiz, question.id, selected) : false;
  const correctText = question.options.find((o) => o.id === question.correctOptionId)?.text;

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-accent uppercase">
        Question {index + 1} of {quiz.questions.length}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={quiz.questions.length}
        aria-valuenow={index + (checked ? 1 : 0)}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${((index + (checked ? 1 : 0)) / quiz.questions.length) * 100}%` }}
        />
      </div>
      <fieldset className="mt-4">
        <legend className="w-full">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ink outline-none">
            {question.prompt}
          </h2>
        </legend>
        <div className="mt-3 space-y-2">
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            const isRight = option.id === question.correctOptionId;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                  !checked && "hover:border-accent-ring hover:bg-subtle",
                  !checked && isSelected && "border-accent bg-accent-soft/60",
                  !checked && !isSelected && "border-line-strong",
                  checked && isRight && "border-emerald-300 bg-emerald-50",
                  checked && isSelected && !isRight && "border-red-300 bg-red-50",
                  checked && !isSelected && !isRight && "border-line opacity-70",
                  checked && "cursor-default",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                )}
              >
                <input
                  type="radio"
                  name={`quiz-${question.id}`}
                  value={option.id}
                  checked={isSelected}
                  disabled={checked}
                  onChange={() => setSelected(option.id)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                <span className="flex-1 text-ink">{option.text}</span>
                {checked && isRight ? <CheckCircle2 aria-hidden className="size-4 text-emerald-700" /> : null}
                {checked && isSelected && !isRight ? <XCircle aria-hidden className="size-4 text-red-700" /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="mt-4">
        {checked ? (
          <div
            className={cn(
              "rounded-lg px-3.5 py-3 text-sm",
              correct ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950",
            )}
          >
            <p className="font-semibold">{correct ? "Correct" : `Not quite. The answer is: ${correctText}`}</p>
            <p className="mt-0.5">{question.explanation}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end">
        {checked ? (
          <Button onClick={next}>{isLast ? "See your result" : "Next question"}</Button>
        ) : (
          <Button onClick={check} disabled={!selected}>
            Check answer
          </Button>
        )}
      </div>
    </div>
  );
}
