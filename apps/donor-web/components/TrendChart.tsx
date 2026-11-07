import type { TrendPoint } from '../lib/api/health-trends';
export function TrendChart({ points, unit }: { points: TrendPoint[]; unit?: string }) {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  const low = Math.min(...sorted.map((p) => p.value));
  const high = Math.max(...sorted.map((p) => p.value));
  const span = high - low || 1;
  const coordinates = sorted.map((p, i) => ({
    x: 40 + (i / (sorted.length - 1 || 1)) * 520,
    y: 170 - ((p.value - low) / span) * 130,
    ...p,
  }));
  return (
    <figure className="donor-trend-chart">
      <figcaption>Ko‘rsatkich dinamikasi {unit && `(${unit})`}</figcaption>
      <svg
        viewBox="0 0 600 210"
        role="img"
        aria-label={`Birinchi qiymat ${sorted[0]!.value}, oxirgi qiymat ${sorted.at(-1)!.value}. Aniq qiymatlar quyidagi jadvalda.`}
      >
        {[40, 105, 170].map((y) => (
          <line key={y} x1="40" x2="560" y1={y} y2={y} stroke="#d6e2e9" />
        ))}
        <polyline
          points={coordinates.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#007da6"
          strokeWidth="3"
        />
        {coordinates.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#007da6">
            <title>
              {p.date}: {p.value} {unit}
            </title>
          </circle>
        ))}
        <text x="40" y="199" fontSize="11" fill="#526777">
          {sorted[0]!.date.slice(0, 10)}
        </text>
        <text x="560" y="199" textAnchor="end" fontSize="11" fill="#526777">
          {sorted.at(-1)!.date.slice(0, 10)}
        </text>
      </svg>
    </figure>
  );
}
