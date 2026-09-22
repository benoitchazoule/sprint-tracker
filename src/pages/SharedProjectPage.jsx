import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Zap, Eye, Moon, Sun, Download, AlertCircle, Users, TrendingUp, CalendarCheck,
  AlertTriangle, LayoutDashboard, Grid3X3,
} from 'lucide-react';
import { fetchSharedProject } from '../hooks/useApi';
import SprintGrid from '../components/SprintGrid';
import { calculateSprints, calculateConsumptionMatrix } from '../lib/calculateSprints';
import { useI18n, LOCALES } from '../i18n';
import { formatNumericDate } from '../utils/dates';

// Read-only consumption view reached through a secret share link.
// No authentication: the token in the URL is the credential, and the
// server only returns this one project's consumption data.
export default function SharedProjectPage() {
  const { token } = useParams();
  const { t, locale, setLocale, dateLocale } = useI18n();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | invalid | error
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [view, setView] = useState('summary'); // summary | detail
  const [activeSprint, setActiveSprint] = useState(-1);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchSharedProject(token)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        const message = `${err?.message || ''}`;
        setStatus(message.includes('invalid_token') ? 'invalid' : 'error');
      });
    return () => { cancelled = true; };
  }, [token]);

  const { rows, totals, developers, project, sprints } = useMemo(() => {
    if (!data) return { rows: [], totals: null, developers: [], project: null, sprints: [] };
    const computed = calculateSprints(data.project, data.developers, data.entries);
    const matrix = calculateConsumptionMatrix(computed, data.developers);
    return { ...matrix, developers: data.developers, project: data.project, sprints: computed };
  }, [data]);

  // Open the day-by-day view on the sprint currently running.
  useEffect(() => {
    if (sprints.length === 0 || activeSprint !== -1) return;
    const today = new Date().toISOString().split('T')[0];
    const idx = sprints.findIndex((s) => s.startDate <= today && s.endDate >= today);
    setActiveSprint(idx >= 0 ? idx : sprints.length - 1);
  }, [sprints, activeSprint]);

  // Exports what is on screen: the sprint × developer matrix on the summary
  // tab, the day-by-day detail of the selected sprint on the detail tab.
  const handleExportCsv = useCallback(() => {
    if (!project) return;
    const sprint = sprints[activeSprint];
    const detail = view === 'detail' && sprint;

    const lines = [];
    if (detail) {
      const today = new Date().toISOString().split('T')[0];
      lines.push([
        t('grid.date'), ...developers.map((d) => d.name),
        t('grid.dayTotal'), t('grid.cumulative'), t('shared.csvStatus'),
      ].join(';'));
      for (const day of sprint.days) {
        lines.push([
          day.date,
          ...developers.map((d) => {
            const devDay = day.developers[d.id];
            if (!devDay || devDay.inactive) return '';
            return fmt(devDay.worked);
          }),
          fmt(day.totalWorked),
          `${fmt(day.cumulativeDays)}/${fmt(sprint.totalDays)}`,
          // Future days carry projected values unless an entry was recorded ahead of time.
          day.date <= today ? t('shared.csvElapsed') : t('shared.csvUpcoming'),
        ].join(';'));
      }
    } else {
      lines.push(['Sprint', 'Start', 'End', ...developers.map((d) => d.name), 'Total', 'Target', 'Delta'].join(';'));
      for (const row of rows) {
        lines.push([
          row.number,
          row.startDate,
          row.endDate,
          ...developers.map((d) => fmt(row.byDev[d.id]?.worked ?? 0)),
          fmt(row.worked),
          fmt(row.target),
          fmt(row.delta),
        ].join(';'));
      }
      lines.push([
        t('shared.total'), '', '',
        ...developers.map((d) => fmt(totals.byDev[d.id]?.worked ?? 0)),
        fmt(totals.worked), fmt(totals.target), '',
      ].join(';'));
    }

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = detail
      ? `${slugify(project.name)}-sprint-${sprint.number}.csv`
      : `${slugify(project.name)}-consumption.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, developers, rows, totals, sprints, activeSprint, view, t]);

  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <Zap size={32} color="var(--primary)" />
        <p>{t('auth.loading')}</p>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className="public-layout">
        <div className="empty-state" style={{ maxWidth: '32rem', margin: '0 auto' }}>
          <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <h3>{t(status === 'invalid' ? 'shared.invalidTitle' : 'shared.errorTitle')}</h3>
          <p>{t(status === 'invalid' ? 'shared.invalidDesc' : 'shared.errorDesc')}</p>
        </div>
      </div>
    );
  }

  const currentRow = rows.find((r) => r.status === 'current')
    || rows.find((r) => r.status === 'upcoming')
    || rows[rows.length - 1];

  return (
    <div className="public-layout">
      <header className="public-topbar">
        <div className="public-brand">
          <Zap size={20} color="var(--primary)" />
          <span>{t('app.title')}</span>
        </div>
        <div className="public-topbar-actions">
          <div className="locale-switch" role="group" aria-label={t('menu.language')}>
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`locale-switch-btn ${locale === l.code ? 'active' : ''}`}
                onClick={() => setLocale(l.code)}
                aria-pressed={locale === l.code}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => setTheme((p) => (p === 'light' ? 'dark' : 'light'))}
            title={theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
            aria-label={theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button type="button" className="btn-secondary btn-icon btn-sm" onClick={handleExportCsv}>
            <Download size={14} /> {t('shared.exportCsv')}
          </button>
        </div>
      </header>

      <main className="public-main">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2>{project.name}</h2>
            <span className="badge badge-blue" style={{ gap: '0.25rem' }}>
              <Eye size={11} /> {t('shared.readOnly')}
            </span>
          </div>
          <p>
            {project.clientName ? `${project.clientName} · ` : ''}
            {t('project.subtitle', {
              days: project.daysPerSprint,
              devs: developers.length,
              sprints: rows.length,
            })}
          </p>
        </div>

        {developers.length === 0 || rows.length === 0 ? (
          <div className="empty-state">
            <h3>{t('dashboard.noData')}</h3>
            <p>{t('shared.noDataDesc')}</p>
          </div>
        ) : (
          <>
            <div className="public-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'summary'}
                className={`btn-sm btn-icon ${view === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('summary')}
              >
                <LayoutDashboard size={14} /> {t('shared.tabSummary')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'detail'}
                className={`btn-sm btn-icon ${view === 'detail' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setView('detail')}
              >
                <Grid3X3 size={14} /> {t('shared.tabDetail')}
              </button>
            </div>

            {view === 'summary' && (
              <div className="fade-in">
                <div className="stats-grid">
                  <StatCard
                    icon={<TrendingUp size={18} color="var(--primary)" />}
                    label={t('dashboard.currentSprint')}
                    value={t('sprint.sprint', { number: currentRow?.number })}
                    valueColor="var(--primary)"
                    detail={`${formatNumericDate(currentRow?.startDate, dateLocale)} – ${formatNumericDate(currentRow?.endDate, dateLocale)}`}
                  />
                  <StatCard
                    icon={<CalendarCheck size={18} color="var(--success)" />}
                    label={t('shared.currentConsumption')}
                    value={`${fmt(currentRow?.worked ?? 0)}/${fmt(currentRow?.target ?? 0)}`}
                    valueColor="var(--success)"
                    detail={t('dashboard.complete', { pct: currentRow?.progressPct ?? 0 })}
                  />
                  <StatCard
                    icon={<Users size={18} color="var(--purple)" />}
                    label={t('shared.totalConsumed')}
                    value={fmt(totals.worked)}
                    valueColor="var(--purple)"
                    detail={t('shared.acrossSprints', { count: rows.length })}
                  />
                  <StatCard
                    icon={<AlertTriangle size={18} color={totals.absent > 0 ? 'var(--danger)' : 'var(--success)'} />}
                    label={t('dashboard.absences')}
                    value={fmt(totals.absent)}
                    valueColor={totals.absent > 0 ? 'var(--danger)' : 'var(--success)'}
                    detail={t('shared.missedDaysTotal')}
                  />
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">{t('shared.matrixTitle')}</h3>
                    <span className="badge badge-purple">{t('shared.daysUnit')}</span>
                  </div>

                  <div className="table-scroll">
                    <table className="sprint-grid consumption-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('shared.sprintCol')}</th>
                          <th scope="col">{t('shared.period')}</th>
                          {developers.map((dev) => (
                            <th key={dev.id} scope="col" className="num">{dev.name}</th>
                          ))}
                          <th scope="col" className="num">{t('shared.total')}</th>
                          <th scope="col" className="num">{t('shared.target')}</th>
                          <th scope="col" className="num">{t('shared.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.number} className={row.status === 'current' ? 'row-current' : ''}>
                            <th scope="row" className="row-head">
                              {t('sprint.sprint', { number: row.number })}
                            </th>
                            <td className="muted nowrap">
                              {formatNumericDate(row.startDate, dateLocale)} – {formatNumericDate(row.endDate, dateLocale)}
                            </td>
                            {developers.map((dev) => {
                              const cell = row.byDev[dev.id] || { worked: 0, absent: 0, projected: 0 };
                              return (
                                <td key={dev.id} className="num">
                                  <span className="cell-main">{fmt(cell.worked)}</span>
                                  {cell.absent > 0 && (
                                    <span className="cell-sub cell-absent" title={t('shared.absentTooltip')}>
                                      −{fmt(cell.absent)}
                                    </span>
                                  )}
                                  {cell.projected > 0 && (
                                    <span className="cell-sub" title={t('shared.projectedTooltip')}>
                                      ~{fmt(cell.projected)}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="num strong">{fmt(row.worked)}</td>
                            <td className="num muted">
                              {fmt(row.target)}
                              {row.carryOver !== 0 && (
                                <span className="cell-sub" title={t('tooltip.sprintCarryOver')}>
                                  {row.carryOver > 0 ? '+' : ''}{fmt(row.carryOver)}
                                </span>
                              )}
                            </td>
                            <td className="num">
                              {row.status === 'current' && <span className="badge badge-blue">{t('dashboard.current')}</span>}
                              {row.status === 'done' && <span className="badge badge-green">{t('dashboard.done')}</span>}
                              {row.status === 'upcoming' && <span className="badge badge-purple">{t('dashboard.upcoming')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row" className="row-head">{t('shared.total')}</th>
                          <td />
                          {developers.map((dev) => (
                            <td key={dev.id} className="num strong">{fmt(totals.byDev[dev.id]?.worked ?? 0)}</td>
                          ))}
                          <td className="num strong">{fmt(totals.worked)}</td>
                          <td className="num muted">{fmt(totals.target)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="table-legend">{t('shared.legend')}</p>
                </div>
              </div>
            )}

            {view === 'detail' && (
              <div className="fade-in">
                <div className="sprint-nav">
                  <div className="sprint-nav-tabs">
                    <div className="sprint-tabs">
                      {sprints.map((s, i) => {
                        const row = rows[i];
                        return (
                          <button
                            key={s.number}
                            type="button"
                            className={`sprint-tab ${activeSprint === i ? 'active' : ''}`}
                            onClick={() => setActiveSprint(i)}
                            aria-pressed={activeSprint === i}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: activeSprint === i ? '#fff' : STATUS_DOT[row?.status] || 'var(--text-light)',
                                marginRight: '0.375rem',
                              }}
                            />
                            {s.number}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {sprints[activeSprint] && (
                    <div className="sprint-nav-meta">
                      <span style={{ color: 'var(--text-light)', fontSize: 'var(--text-xs)' }}>
                        {formatNumericDate(sprints[activeSprint].startDate, dateLocale)} &rarr; {formatNumericDate(sprints[activeSprint].endDate, dateLocale)}
                      </span>
                      <span className="badge badge-blue">
                        {t('sprint.days', {
                          consumed: fmt(sprints[activeSprint].daysConsumed),
                          target: fmt(sprints[activeSprint].effectiveTarget ?? sprints[activeSprint].totalDays),
                        })}
                      </span>
                      {!!sprints[activeSprint].carryOver && (
                        <span className={`badge ${sprints[activeSprint].carryOver > 0 ? 'badge-red' : 'badge-green'}`}>
                          {t('sprint.fromPrev', { value: (sprints[activeSprint].carryOver > 0 ? '+' : '') + fmt(sprints[activeSprint].carryOver) })}
                        </span>
                      )}
                      {!!sprints[activeSprint].delta && (
                        <span className={`badge ${sprints[activeSprint].delta > 0 ? 'badge-red' : 'badge-green'}`}>
                          {t('sprint.delta', { value: (sprints[activeSprint].delta > 0 ? '+' : '') + fmt(sprints[activeSprint].delta) })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {sprints[activeSprint] && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <SprintGrid
                      readOnly
                      sprint={sprints[activeSprint]}
                      developers={developers.filter((dev) => {
                        const sprint = sprints[activeSprint];
                        // Keep a developer whose active period overlaps the sprint
                        if (dev.endDate && dev.endDate < sprint.startDate) return false;
                        if (dev.startDate && dev.startDate > sprint.endDate) return false;
                        return true;
                      })}
                    />
                  </div>
                )}

                <p className="table-legend">{t('shared.gridLegend')}</p>
              </div>
            )}
          </>
        )}

        <p className="public-footer">{t('shared.footer')}</p>
      </main>
    </div>
  );
}

const STATUS_DOT = {
  done: 'var(--success)',
  current: 'var(--primary)',
  upcoming: 'var(--purple)',
};

function StatCard({ icon, label, value, valueColor, detail }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value" style={{ color: valueColor }}>{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

// Days are stored as halves — show "3" not "3.0", but keep "3.5".
function fmt(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function slugify(name) {
  return (name || 'project')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
}
