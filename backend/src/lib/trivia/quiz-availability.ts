import {
  isTriviaActivityAvailable,
  type TriviaActivityTiming,
} from "./session-timing";

type QuizQuestionTiming = TriviaActivityTiming & {
  id: number;
};

export function isTriviaQuizFullyAvailable(
  questions: readonly QuizQuestionTiming[],
  now: number
): boolean {
  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        question.durationSeconds === null &&
        isTriviaActivityAvailable(question, now)
    )
  );
}
