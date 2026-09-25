export function AnswerCounts({ correct, incorrect }: { correct: number; incorrect: number }) {
  return (
    <span className="answer-counts wa-cluster wa-gap-s">
      <span className="count count-correct">
        <wa-icon name="check" label="Gewusst"></wa-icon> {correct}
      </span>
      <span className="count count-incorrect">
        <wa-icon name="xmark" label="Falsch"></wa-icon> {incorrect}
      </span>
    </span>
  );
}
