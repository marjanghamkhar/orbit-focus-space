import { useId, type ReactNode } from 'react';

interface ProgressRingProps {
  /** 0 → 1 */
  progress: number;
  size: number;
  stroke: number;
  tone?: 'accent' | 'mint';
  /** Smooth, linear motion for the countdown; springy easing for task progress. */
  motion?: 'linear' | 'ease';
  className?: string;
  children?: ReactNode;
}

export function ProgressRing({
  progress,
  size,
  stroke,
  tone = 'accent',
  motion = 'ease',
  className = '',
  children,
}: ProgressRingProps) {
  const gradientId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className={`ring ring--${tone} ring--${motion} ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {tone === 'mint' ? (
              <>
                <stop offset="0" stopColor="#3DD9A6" />
                <stop offset="1" stopColor="#12A97A" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#A698FF" />
                <stop offset="1" stopColor="#5E4AE6" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring__bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ opacity: clamped === 0 ? 0 : 1 }}
        />
      </svg>
      {children && <div className="ring__center">{children}</div>}
    </div>
  );
}
