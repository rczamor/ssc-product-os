/**
 * Minimal dependency-free trend line — no charting library in this project's
 * dependencies, and a 12-point sparkline doesn't warrant adding one.
 */
export default function Sparkline({
  values,
  width = 160,
  height = 36,
  strokeClassName = "stroke-accent",
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeClassName?: string;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="text-xs text-ink-6" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        className={strokeClassName}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
