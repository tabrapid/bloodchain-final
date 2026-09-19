import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  showValues?: boolean;
  className?: string;
}

export function BarChart({
  data,
  height = 200,
  showValues = true,
  className,
}: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <div className="flex h-full items-end gap-2">
        {data.map((datum, i) => {
          const barHeight = (datum.value / maxValue) * 100;
          const color = datum.color || 'bg-donor-primary';

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full items-end justify-center" style={{ height: '80%' }}>
                <div
                  className={cn('w-full rounded-t-md transition-all', color)}
                  style={{ height: `${barHeight}%` }}
                  title={`${datum.label}: ${datum.value}`}
                />
                {showValues && (
                  <span className="absolute -top-5 text-xs font-semibold text-donor-text">
                    {datum.value}
                  </span>
                )}
              </div>
              <span className="truncate text-xs text-donor-muted" title={datum.label}>
                {datum.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface DonutChartDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutChartDatum[];
  size?: number;
  className?: string;
}

export function DonutChart({
  data,
  size = 160,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const segments = data.map((datum) => {
    const percent = total > 0 ? (datum.value / total) * 100 : 0;
    const startPercent = accumulatedPercent;
    accumulatedPercent += percent;
    return {
      ...datum,
      percent,
      startPercent,
      dashArray: `${(percent / 100) * circumference} ${circumference}`,
      dashOffset: -((startPercent / 100) * circumference),
    };
  });

  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="20"
            className="text-donor-border"
          />
          {segments.map((segment, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="20"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-donor-text">{total}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((datum, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: datum.color }}
            />
            <span className="text-sm text-donor-muted">{datum.label}</span>
            <span className="text-sm font-semibold text-donor-text">
              {datum.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface LineChartDatum {
  date: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartDatum[];
  height?: number;
  showValues?: boolean;
  className?: string;
}

export function LineChart({
  data,
  height = 200,
  showValues = true,
  className,
}: LineChartProps) {
  const { t } = useOptionalTranslation();

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-donor-muted', className)} style={{ height }}>
        {t('common.noData')}
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;
  const chartHeight = height - 40;
  const pointSpacing = 100 / (data.length - 1 || 1);

  const points = data.map((datum, i) => ({
    x: i * pointSpacing,
    y: chartHeight - ((datum.value - minValue) / range) * chartHeight + 20,
    value: datum.value,
    date: datum.date,
  }));

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible">
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-donor-primary"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={`${point.x}%`}
              cy={point.y}
              r="4"
              fill="currentColor"
              className="text-donor-primary"
            />
            {showValues && (
              <text
                x={`${point.x}%`}
                y={point.y - 12}
                textAnchor="middle"
                className="fill-donor-text text-xs font-semibold"
              >
                {point.value}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2">
        {data.length <= 7 ? (
          data.map((d, i) => (
            <span key={i} className="text-xs text-donor-muted">
              {d.date}
            </span>
          ))
        ) : (
          <>
            <span className="text-xs text-donor-muted">{data[0]?.date}</span>
            <span className="text-xs text-donor-muted">{data[data.length - 1]?.date}</span>
          </>
        )}
      </div>
    </div>
  );
}
