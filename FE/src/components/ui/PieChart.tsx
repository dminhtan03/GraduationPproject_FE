import React from "react";
import type { StatusCount } from "../../services/adminService";
import { numberFmt, STATUS_COLOR, STATUS_LABEL } from "../../constants/dashboard";

// ── Pie Chart (SVG) ────────────────────────────────────────────────────────────
const R  = 70;
const CX = 90;
const CY = 90;

type Slice = StatusCount & { startAngle: number; sweep: number };

const NoDataPlaceholder: React.FC = () => (
  <div className="flex h-48 items-center justify-center text-sm text-slate-400">
    No data available
  </div>
);

const describeArc = (start: number, sweep: number): string => {
  const x1    = CX + R * Math.cos(start);
  const y1    = CY + R * Math.sin(start);
  const x2    = CX + R * Math.cos(start + sweep);
  const y2    = CY + R * Math.sin(start + sweep);
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
};

const buildSlices = (data: StatusCount[]): Slice[] => {
  let angle = -Math.PI / 2;
  return data.map((d) => {
    const total = data.reduce((s, x) => s + x.count, 0);
    const sweep = (d.count / total) * 2 * Math.PI;
    const startAngle = angle;
    angle += sweep;
    return { ...d, startAngle, sweep };
  });
};

// ── Legend Row ────────────────────────────────────────────────────────────────
const LegendRow: React.FC<{ slice: Slice }> = ({ slice }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full"
        style={{ background: STATUS_COLOR[slice.status] ?? "#94a3b8" }}
      />
      <span className="text-slate-700">
        {STATUS_LABEL[slice.status] ?? slice.status}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-semibold text-slate-900">
        {numberFmt.format(slice.count)}
      </span>
      <span className="w-12 text-right text-xs text-slate-400">
        {slice.percentage}%
      </span>
    </div>
  </div>
);

// ── PieChart ──────────────────────────────────────────────────────────────────
const PieChart: React.FC<{ data: StatusCount[] }> = ({ data }) => {
  if (!data || data.length === 0) return <NoDataPlaceholder />;

  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <NoDataPlaceholder />;

  const slices = buildSlices(data);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 180 180"
        className="h-44 w-44 shrink-0"
        aria-label="Booking status pie chart"
      >
        {slices.map((s) =>
          s.sweep > 0.01 ? (
            <path
              key={s.status}
              d={describeArc(s.startAngle, s.sweep)}
              fill={STATUS_COLOR[s.status] ?? "#94a3b8"}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null,
        )}
        {/* Centre hole */}
        <circle cx={CX} cy={CY} r={36} fill="#fff" />
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="#1e293b"
        >
          {total}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize={9} fill="#64748b">
          bookings
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-1 flex-col gap-1.5">
        {slices.map((s) => (
          <LegendRow key={s.status} slice={s} />
        ))}
      </div>
    </div>
  );
};

export default PieChart;
