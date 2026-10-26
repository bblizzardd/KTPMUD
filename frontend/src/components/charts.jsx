import { DOSE_STATUS } from '../domain/constants.js';
import { fmtDate, fmtDateShort, weekdayOf } from '../lib/time.js';
import { fmtNumber } from '../lib/text.js';

export const BREAKDOWN = [
  { key: 'TAKEN', field: 'taken', color: 'var(--success)' },
  { key: 'TAKEN_BY_DELEGATE', field: 'takenByDelegate', color: 'var(--delegate)' },
  { key: 'LATE_CONFIRMED', field: 'lateConfirmed', color: '#e3962f' },
  { key: 'MISSED', field: 'missed', color: 'var(--danger)' }
];

/** Thanh phân rã 4 kết quả của các cữ đã đến hạn trong kỳ. */
export function StatusBreakdown({ summary }) {
  const total = summary.totalDoses || 0;
  return (
    <div className="breakdown">
      <div className="breakdown-bar" role="img" aria-label={BREAKDOWN.map((b) => `${DOSE_STATUS[b.key].label}: ${summary[b.field]}`).join(', ')}>
        {total === 0 && <span className="breakdown-empty" />}
        {BREAKDOWN.map((b) =>
          summary[b.field] > 0 ? (
            <span
              key={b.key}
              style={{ width: `${(summary[b.field] / total) * 100}%`, background: b.color }}
              title={`${DOSE_STATUS[b.key].label}: ${summary[b.field]} cữ`}
            />
          ) : null
        )}
      </div>
      <ul className="breakdown-legend">
        {BREAKDOWN.map((b) => (
          <li key={b.key}>
            <span className="legend-swatch" style={{ background: b.color }} />
            <span className="legend-label">{DOSE_STATUS[b.key].label}</span>
            <span className="legend-value num">{summary[b.field]}</span>
            <span className="legend-pct num">{total ? `${Math.round((summary[b.field] / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelEvery(n) {
  if (n <= 10) return 1;
  if (n <= 31) return 5;
  return 14;
}

/** Cột chồng theo ngày: mỗi cột là các cữ của một ngày, chia theo trạng thái. */
export function DailyBars({ daily, today }) {
  const max = Math.max(1, ...daily.map((d) => d.TAKEN + d.TAKEN_BY_DELEGATE + d.LATE_CONFIRMED + d.MISSED + d.PENDING));
  const every = labelEvery(daily.length);
  return (
    <div className={`daily ${daily.length > 40 ? 'is-dense' : ''}`}>
      <div className="daily-cols" role="img" aria-label={`Biểu đồ ${daily.length} ngày gần nhất theo trạng thái cữ thuốc`}>
        {daily.map((d) => {
          const parts = [
            ...BREAKDOWN.map((b) => ({ key: b.key, n: d[b.key], color: b.color })),
            { key: 'PENDING', n: d.PENDING, color: 'var(--info-border)' }
          ];
          const total = parts.reduce((s, p) => s + p.n, 0);
          const tip = `${weekdayOf(d.date)}, ${fmtDate(d.date)}\n${parts
            .filter((p) => p.n > 0)
            .map((p) => `${DOSE_STATUS[p.key].label}: ${p.n}`)
            .join('\n') || 'Không có cữ đến hạn'}`;
          return (
            <div key={d.date} className={`daily-col ${d.date === today ? 'is-today' : ''}`} title={tip}>
              <div className="daily-stack" style={{ height: `${(total / max) * 100}%` }}>
                {parts.map((p) =>
                  p.n > 0 ? <span key={p.key} style={{ flexGrow: p.n, background: p.color }} /> : null
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="daily-axis" aria-hidden="true">
        {daily.map((d, i) => (
          <span key={d.date}>{(daily.length - 1 - i) % every === 0 ? (d.date === today ? 'H.nay' : fmtDateShort(d.date)) : ''}</span>
        ))}
      </div>
    </div>
  );
}

/** Đường xu hướng chỉ số xét nghiệm (US-15). */
export function TrendChart({ points, unit, height = 220 }) {
  if (!points.length) return null;
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 24, t: 30, b: 34 };
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1) {
    lo -= 0.5;
    hi += 0.5;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.2);
  hi = hi + span * 0.2;
  const times = points.map((p) => Date.parse(`${p.date}T12:00:00`));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (t) => (t1 === t0 ? pad.l + (W - pad.l - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Xu hướng: ${points.map((p) => `${fmtDate(p.date)} ${fmtNumber(p.value)} ${unit}`).join('; ')}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="trend-grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="trend-tick">
            {fmtNumber(Math.round(t * 10) / 10)}
          </text>
        </g>
      ))}
      <path d={path} className="trend-line" />
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`}>
          <circle cx={x(times[i])} cy={y(p.value)} r={5} className="trend-dot" />
          <text x={x(times[i])} y={y(p.value) - 11} textAnchor="middle" className="trend-value">
            {fmtNumber(p.value)}
          </text>
          <text x={x(times[i])} y={H - 10} textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'} className="trend-tick">
            {fmtDate(p.date).slice(0, 6) + fmtDate(p.date).slice(8)}
          </text>
        </g>
      ))}
    </svg>
  );
}
