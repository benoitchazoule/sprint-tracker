import React from 'react';
import { Calendar, Users, TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDate, formatNumericDate, daysBetween } from '../utils/dates';
import { useI18n } from '../i18n';

export default function Dashboard({ project, sprints, developers }) {
  const { t, dateLocale } = useI18n();

  if (!sprints || sprints.length === 0) {
    return (
      <div className="empty-state">
        <h3>{t('dashboard.noData')}</h3>
        <p>{t('dashboard.noDataDesc')}</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  const currentSprint = sprints.find((s) => s.startDate <= today && s.endDate >= today)
    || sprints.find((s) => s.startDate > today)
    || sprints[sprints.length - 1];

  const currentSprintConsumed = currentSprint
    ? currentSprint.days.filter((d) => d.date <= today).reduce((sum, d) => sum + d.totalWorked, 0)
    : 0;

  const currentEffectiveTarget = currentSprint?.effectiveTarget ?? (project.daysPerSprint || 18);
  const progressPct = (currentSprintConsumed / currentEffectiveTarget) * 100;

  const pastDays = currentSprint
    ? currentSprint.days.filter((d) => d.date <= today)
    : [];
  const avgBurnRate = pastDays.length > 0
    ? (pastDays.reduce((s, d) => s + d.totalWorked, 0) / pastDays.length).toFixed(1)
    : '-';

  const daysRemaining = currentEffectiveTarget - currentSprintConsumed;

  const totalAbsences = pastDays.reduce((sum, d) => {
    return sum + developers.reduce((s, dev) => {
      const devDay = d.developers[dev.id];
      if (!devDay || devDay.inactive) return s;
      return s + (devDay.worked < 1 ? (1 - devDay.worked) : 0);
    }, 0);
  }, 0);

  const absenceDays = [];
  for (const day of pastDays) {
    for (const dev of developers) {
      const devDay = day.developers[dev.id];
      if (devDay && devDay.worked < 1 && !devDay.inactive) {
        absenceDays.push({ date: day.date, developer: dev.name, comment: devDay.comment, worked: devDay.worked });
      }
    }
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={18} color="var(--primary)" />
            <span className="stat-label">{t('dashboard.currentSprint')}</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {t('sprint.sprint', { number: currentSprint?.number })}
          </div>
          <div className="stat-detail">
            {formatDate(currentSprint?.startDate, dateLocale)} - {formatDate(currentSprint?.endDate, dateLocale)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Calendar size={18} color="var(--success)" />
            <span className="stat-label">{t('dashboard.progress')}</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {currentSprintConsumed}/{currentEffectiveTarget}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div className="progress-bar" style={{ height: '10px' }} role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100} aria-label={t('dashboard.progress')}>
              <div
                className={`progress-fill ${progressPct >= 100 ? 'green' : progressPct >= 70 ? 'blue' : 'orange'}`}
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>
          <div className="stat-detail">
            {t('dashboard.complete', { pct: Math.round(progressPct) })}
            {currentSprint?.carryOver !== 0 && currentSprint?.carryOver != null && (
              <span style={{ marginLeft: '0.5rem', color: currentSprint.carryOver > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {t('dashboard.carryOver', { value: (currentSprint.carryOver > 0 ? '+' : '') + currentSprint.carryOver })}
              </span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Clock size={18} color="var(--warning)" />
            <span className="stat-label">{t('dashboard.daysRemaining')}</span>
          </div>
          <div className="stat-value" style={{ color: daysRemaining <= 2 ? 'var(--danger)' : 'var(--warning)' }}>
            {daysRemaining}
          </div>
          <div className="stat-detail">{t('dashboard.burnRate', { value: avgBurnRate })}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={18} color={totalAbsences > 0 ? 'var(--danger)' : 'var(--success)'} />
            <span className="stat-label">{t('dashboard.absences')}</span>
          </div>
          <div className="stat-value" style={{ color: totalAbsences > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {totalAbsences}
          </div>
          <div className="stat-detail">{t('dashboard.missedDays')}</div>
        </div>
      </div>

      {/* Sprint overview cards */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h3 className="card-title">{t('dashboard.allSprints')}</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sprints.map((sprint) => {
            const consumed = sprint.days
              .filter((d) => d.date <= today)
              .reduce((sum, d) => sum + d.totalWorked, 0);
            const effectiveTarget = sprint.effectiveTarget ?? sprint.totalDays;
            const pct = (consumed / effectiveTarget) * 100;
            const isCompleted = pct >= 100 || sprint.endDate < today;
            const isCurrent = !isCompleted && sprint.startDate <= today && sprint.endDate >= today;
            const isFuture = !isCompleted && !isCurrent && sprint.startDate > today;
            const carry = sprint.carryOver || 0;
            const delta = sprint.delta || 0;

            return (
              <div
                key={sprint.number}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: isCurrent ? 'var(--primary-light)' : 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  border: isCurrent ? '1px solid var(--primary)' : '1px solid transparent',
                }}
              >
                <div title={t('tooltip.sprintNumber')} style={{ width: '70px', flexShrink: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {t('sprint.sprint', { number: sprint.number })}
                </div>

                <div title={t('tooltip.sprintStatus')} style={{ width: '80px', flexShrink: 0 }}>
                  {isCurrent && <span className="badge badge-blue">{t('dashboard.current')}</span>}
                  {isCompleted && <span className="badge badge-green">{t('dashboard.done')}</span>}
                  {isFuture && <span className="badge badge-purple">{t('dashboard.upcoming')}</span>}
                </div>

                <div title={t('tooltip.sprintProgress')} style={{ flex: 1, minWidth: 0 }}>
                  <div className="progress-bar" style={{ height: '6px' }}>
                    <div
                      className={`progress-fill ${isCompleted ? 'green' : isCurrent ? 'blue' : 'orange'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div title={t('tooltip.sprintDates')} style={{ width: '160px', flexShrink: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {formatNumericDate(sprint.startDate, dateLocale)} - {formatNumericDate(sprint.endDate, dateLocale)}
                </div>

                <div title={t('tooltip.sprintConsumed')} style={{ width: '55px', flexShrink: 0, fontSize: '0.8125rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {consumed}/{effectiveTarget}
                </div>

                <div title={t('tooltip.sprintOriginalDays')} style={{ width: '35px', flexShrink: 0, fontSize: '0.6875rem', color: 'var(--text-light)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {effectiveTarget !== sprint.totalDays ? `(${sprint.totalDays})` : ''}
                </div>

                <div title={t('tooltip.sprintCarryOver')} style={{ width: '45px', flexShrink: 0, textAlign: 'right' }}>
                  <span className={`badge ${carry > 0 ? 'badge-red' : carry < 0 ? 'badge-green' : ''}`} style={{ fontSize: '0.6875rem' }}>
                    {carry > 0 ? '+' : ''}{carry}
                  </span>
                </div>

                <div title={t('tooltip.sprintDelta')} style={{ width: '45px', flexShrink: 0, textAlign: 'right' }}>
                  <span className={`badge ${delta > 0 ? 'badge-red' : delta < 0 ? 'badge-green' : ''}`} style={{ fontSize: '0.6875rem' }}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Absence log */}
      {absenceDays.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.absenceLog')}</h3>
            <span className="badge badge-red">{t('dashboard.absenceCount', { count: absenceDays.length })}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {absenceDays.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.5rem 0.75rem',
                  background: a.worked === 0.5 ? 'var(--warning-light)' : 'var(--danger-light)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8125rem',
                }}
              >
                {a.worked === 0.5
                  ? <span style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '0.875rem' }}>½</span>
                  : <XIcon size={14} color="var(--danger)" />
                }
                <span style={{ fontWeight: 600 }}>{formatDate(a.date, dateLocale)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{a.developer}</span>
                {a.worked === 0.5 && <span className="badge badge-orange">{t('grid.halfDay')}</span>}
                {a.comment && (
                  <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>- {a.comment}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function XIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
