"use client";

interface SeoGaugeProps {
  score: number | null;
  size?: number;
}

export function SeoGauge({ score, size = 100 }: SeoGaugeProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  if (score === null) {
    return (
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            className="text-muted"
          />
        </svg>
        <span className="absolute text-sm text-muted-foreground">N/A</span>
      </div>
    );
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color =
    clampedScore >= 80
      ? "text-green-500"
      : clampedScore >= 60
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-700`}
        />
      </svg>
      <span className="absolute text-lg font-bold">{clampedScore}</span>
    </div>
  );
}
