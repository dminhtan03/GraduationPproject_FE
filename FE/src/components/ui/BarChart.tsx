import React from "react";
import type { DailyTrend } from "../../services/adminService";

// ── Bar Chart (SVG) ────────────────────────────────────────────────────────────
const CHART_WIDTH  = 560;
const CHART_HEIGHT = 160;
const PAD_LEFT     = 32;
const PAD_BOTTOM   = 36;
const Y_TICKS      = [0, 0.25, 0.5, 0.75, 1];

const NoDataPlaceholder: React.FC = () => (
  <div className="flex h-48 items-center justify-center text-sm text-slate-400">
    No data available
  </div>
);

const BarChart: React.FC<{ data: DailyTrend[] }> = ({ data }) => {
  if (!data || data.length === 0) return <NoDataPlaceholder />;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const innerW  = CHART_WIDTH - PAD_LEFT - 16;
  const barW    = Math.floor(innerW / data.length) - 6;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + PAD_BOTTOM}`}
      className="w-full"
      aria-label="Daily booking bar chart"
    >
      {/* Y-axis grid lines */}
      {Y_TICKS.map((t) => {
        const y = CHART_HEIGHT - t * CHART_HEIGHT;
        return (
          <g key={t}>
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={CHART_WIDTH - 8}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 4}
              y={y + 4}
              fontSize={10}
              fill="#94a3b8"
              textAnchor="end"
            >
              {Math.round(t * maxVal)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x  = PAD_LEFT + i * (innerW / data.length) + 3;
        const bH = Math.max((d.count / maxVal) * CHART_HEIGHT, d.count > 0 ? 4 : 0);
        const y  = CHART_HEIGHT - bH;
        const dateLabel = d.date.slice(5); // "MM-DD"

        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bH}
              rx={4}
              fill="url(#barGrad)"
              opacity={0.9}
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                fontSize={9}
                fill="#64748b"
                textAnchor="middle"
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={CHART_HEIGHT + PAD_BOTTOM - 4}
              fontSize={9}
              fill="#94a3b8"
              textAnchor="middle"
            >
              {dateLabel}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default BarChart;
