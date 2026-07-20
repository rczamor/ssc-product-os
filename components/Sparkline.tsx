/**
 * Minimal dependency-free trend line — no charting library in this project's
 * dependencies, and a 12-point sparkline doesn't warrant adding one. Geometry
 * matches the mockup's `spark()` helper exactly ((height-3) plot area, 1.5px
 * top/bottom padding) so the 116×28 metric-card sparkline is pixel-identical.
 */
export default function Sparkline({
  values,
  width = 116,
  height = 28,
  strokeWidth = 1.5,
  opacity = 0.9,
  color,
  strokeClassName,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  opacity?: number;
  /** Raw stroke color (hex/rgb). Takes precedence over strokeClassName. */
  color?: string;
  /** Tailwind stroke-* class fallback when no explicit color is given. */
  strokeClassName?: string;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="shrink-0" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        className={color ? undefined : strokeClassName}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    </svg>
  );
}
