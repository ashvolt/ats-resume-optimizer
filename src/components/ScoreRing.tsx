interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

export function ScoreRing({ score, size = 84, label = "ATS score" }: ScoreRingProps) {
  const inner = size - 20;
  return (
    <div
      className="score-ring"
      style={{ width: size, height: size, ["--pct" as string]: score }}
      role="img"
      aria-label={`${label}: ${score} out of 100`}
    >
      <div className="score-ring-inner" style={{ width: inner, height: inner }}>
        <span className="num" style={{ fontSize: inner * 0.3 }}>
          {score}
        </span>
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
}
