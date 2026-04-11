"use client";

type ProfileCompletionRingProps = {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  progressClassName?: string;
  textClassName?: string;
};

export default function ProfileCompletionRing({
  percentage,
  size = 74,
  strokeWidth = 7,
  trackClassName = "stroke-white/18",
  progressClassName = "stroke-white",
  textClassName = "text-white",
}: ProfileCompletionRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const boundedPercentage = Math.min(100, Math.max(0, percentage));
  const dashOffset = circumference - (boundedPercentage / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-all duration-500 ${progressClassName}`}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${textClassName}`}>
        {boundedPercentage}%
      </div>
    </div>
  );
}
