import React from 'react';
import { isToday, isPast, getDayName } from '../utils/dates';

export default function BurndownChart({ sprint }) {
  if (!sprint || !sprint.days || sprint.days.length === 0) return null;

  const effectiveTarget = sprint.effectiveTarget ?? sprint.totalDays;
  const days = sprint.days;
  const totalWorkDays = days.length;

  // Chart dimensions
  const W = 600, H = 260;
  const pad = { top: 20, right: 30, bottom: 50, left: 50 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  // Scales
  const xScale = (i) => pad.left + (i / (totalWorkDays - 1 || 1)) * cw;
  const yScale = (v) => pad.top + ((effectiveTarget - v) / (effectiveTarget || 1)) * ch;

  // Ideal line: from effectiveTarget to 0
  const idealStart = { x: xScale(0), y: yScale(effectiveTarget) };
  const idealEnd = { x: xScale(totalWorkDays - 1), y: yScale(0) };

  // Actual line: effectiveTarget - cumulativeDays for each past day
  const today = new Date().toISOString().split('T')[0];
  const actualPoints = [];
  let todayIdx = -1;

  // Start point: full remaining at day 0 (before any work)
  actualPoints.push({ x: xScale(0), y: yScale(effectiveTarget), remaining: effectiveTarget });

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.date <= today) {
      const remaining = effectiveTarget - day.cumulativeDays;
      actualPoints.push({ x: xScale(i + (i < days.length - 1 ? 0.5 : 0)), y: yScale(remaining), remaining, date: day.date });
      if (isToday(day.date)) todayIdx = i;
    }
  }

  // Build actual path
  const actualPath = actualPoints.length > 1
    ? actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : '';

  // Y-axis ticks
  const yTicks = [];
  const yStep = Math.max(1, Math.ceil(effectiveTarget / 5));
  for (let v = 0; v <= effectiveTarget; v += yStep) {
    yTicks.push(v);
  }
  if (yTicks[yTicks.length - 1] !== effectiveTarget) yTicks.push(effectiveTarget);

  // X-axis ticks (show every N days to avoid crowding)
  const xTickInterval = totalWorkDays <= 10 ? 1 : totalWorkDays <= 20 ? 2 : 5;

  return (
    <div className="card burndown-card">
      <div className="card-header">
        <h3 className="card-title">Burndown Chart (Sprint {sprint.number})</h3>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: '300px' }} role="img" aria-label={`Burndown chart for sprint ${sprint.number}`}>
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={`grid-${v}`}
            x1={pad.left} y1={yScale(v)}
            x2={W - pad.right} y2={yScale(v)}
            stroke="var(--border)" strokeWidth="0.5"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={`y-${v}`}
            x={pad.left - 8} y={yScale(v) + 4}
            textAnchor="end" fontSize="10" fill="var(--text-secondary)"
          >
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        {days.map((day, i) => {
          if (i % xTickInterval !== 0 && i !== days.length - 1) return null;
          return (
            <text
              key={`x-${i}`}
              x={xScale(i)} y={H - pad.bottom + 16}
              textAnchor="middle" fontSize="9" fill="var(--text-secondary)"
              transform={`rotate(-30, ${xScale(i)}, ${H - pad.bottom + 16})`}
            >
              {getDayName(day.date)} {day.date.slice(8)}
            </text>
          );
        })}

        {/* Ideal line */}
        <line
          x1={idealStart.x} y1={idealStart.y}
          x2={idealEnd.x} y2={idealEnd.y}
          stroke="var(--text-light)" strokeWidth="2" strokeDasharray="6,4"
        />

        {/* Actual line */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
        )}

        {/* Actual dots */}
        {actualPoints.slice(1).map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.x} cy={p.y} r="3.5"
            fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="1.5"
          />
        ))}

        {/* Today marker */}
        {todayIdx >= 0 && (
          <line
            x1={xScale(todayIdx)} y1={pad.top}
            x2={xScale(todayIdx)} y2={H - pad.bottom}
            stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="4,3"
          />
        )}

        {/* Zero line highlight */}
        <line
          x1={pad.left} y1={yScale(0)}
          x2={W - pad.right} y2={yScale(0)}
          stroke="var(--text-light)" strokeWidth="1"
        />

        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
        <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="var(--border)" strokeWidth="1" />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="var(--text-light)" strokeWidth="2" strokeDasharray="4,3" /></svg>
          Ideal
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="var(--primary)" strokeWidth="2.5" /></svg>
          Actual
        </span>
        {todayIdx >= 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
            Today
          </span>
        )}
      </div>
    </div>
  );
}
