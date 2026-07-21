interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ScoreRing({ score, size = 120, strokeWidth = 10, label }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const offset = circumference - (value / 100) * circumference;

  let color = "#ef4444";
  if (value >= 90) color = "#059669";
  else if (value >= 80) color = "#10b981";
  else if (value >= 70) color = "#3b82f6";
  else if (value >= 60) color = "#f59e0b";
  else if (value >= 40) color = "#f97316";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900 font-mono">{score ?? "—"}</span>
        {label && <span className="text-xs text-slate-500 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
