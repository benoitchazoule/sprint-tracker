import React, { useState, useRef, useEffect } from 'react';
import { formatNumericDate, getDayName, isToday, isPast } from '../utils/dates';
import { useI18n } from '../i18n';
import { MessageSquare, Check, X } from 'lucide-react';

export default function SprintGrid({ sprint, developers, onToggleDay, onUpdateComment, onResetDay }) {
  const { t, dateLocale } = useI18n();
  const [commentPopup, setCommentPopup] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [focusedCell, setFocusedCell] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [lastClicked, setLastClicked] = useState(null);
  const popupRef = useRef(null);
  const todayRef = useRef(null);
  const cellRefs = useRef({});
  const tableRef = useRef(null);

  const COMMENT_PRESETS = [t('preset.holiday'), t('preset.sick'), t('preset.hackday')];

  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [sprint]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setCommentPopup(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (focusedCell) {
      const key = `${focusedCell.row}-${focusedCell.col}`;
      cellRefs.current[key]?.focus();
    }
  }, [focusedCell]);

  if (!sprint || !sprint.days) {
    return <div className="empty-state"><h3>{t('grid.noData')}</h3></div>;
  }

  function isCellInteractive(rowIdx, colIdx) {
    const day = sprint.days[rowIdx];
    if (!day) return false;
    const dev = developers[colIdx];
    if (!dev) return false;
    const devDay = day.developers[dev.id];
    if (!devDay || devDay.inactive) return false;
    return true;
  }

  function handleToggle(date, devId, currentWorked, currentComment, hasEntry) {
    // Cycle: default → ½ → ✗ → default (reset removes the entry)
    if (currentWorked === 0 && hasEntry && onResetDay) {
      onResetDay(devId, date, currentWorked, currentComment || '');
      return;
    }
    const newWorked = currentWorked === 1 ? 0.5 : currentWorked === 0.5 ? 0 : 1;
    onToggleDay(devId, date, newWorked, currentComment || '', currentWorked);
  }

  function handleCellClick(rowIdx, colIdx, date, devId, worked, comment, hasEntry, e) {
    if (e.shiftKey && lastClicked) {
      const newSelection = new Set(selection);
      const startRow = Math.min(lastClicked.row, rowIdx);
      const endRow = Math.max(lastClicked.row, rowIdx);
      const startCol = Math.min(lastClicked.col, colIdx);
      const endCol = Math.max(lastClicked.col, colIdx);
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (isCellInteractive(r, c)) {
            const d = sprint.days[r];
            const dev = developers[c];
            newSelection.add(`${d.date}|${dev.id}`);
          }
        }
      }
      setSelection(newSelection);
    } else {
      setSelection(new Set());
      handleToggle(date, devId, worked, comment, hasEntry);
    }
    setLastClicked({ row: rowIdx, col: colIdx });
    setFocusedCell({ row: rowIdx, col: colIdx });
  }

  function handleKeyDown(e) {
    if (!focusedCell) return;
    const { row, col } = focusedCell;
    let newRow = row, newCol = col;

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); for (let r = row - 1; r >= 0; r--) { if (isCellInteractive(r, col)) { newRow = r; break; } } break;
      case 'ArrowDown': e.preventDefault(); for (let r = row + 1; r < sprint.days.length; r++) { if (isCellInteractive(r, col)) { newRow = r; break; } } break;
      case 'ArrowLeft': e.preventDefault(); for (let c = col - 1; c >= 0; c--) { if (isCellInteractive(row, c)) { newCol = c; break; } } break;
      case 'ArrowRight': e.preventDefault(); for (let c = col + 1; c < developers.length; c++) { if (isCellInteractive(row, c)) { newCol = c; break; } } break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (isCellInteractive(row, col)) {
          const day = sprint.days[row]; const dev = developers[col]; const devDay = day.developers[dev.id];
          handleToggle(day.date, dev.id, devDay.worked, devDay.comment, devDay.hasEntry);
        }
        return;
      case 'Escape': setFocusedCell(null); setSelection(new Set()); return;
      default: return;
    }
    if (newRow !== row || newCol !== col) setFocusedCell({ row: newRow, col: newCol });
  }

  async function handleBulkAction(worked) {
    for (const key of selection) {
      const [date, devId] = key.split('|');
      await onToggleDay(devId, date, worked, '');
    }
    setSelection(new Set());
  }

  function openCommentPopup(date, devId, currentComment, e) {
    const rect = e.target.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // If less than 200px below, open above the icon instead
    const openAbove = spaceBelow < 200;
    setCommentPopup({
      date,
      devId,
      x: rect.left,
      y: openAbove ? rect.top : rect.bottom + 4,
      above: openAbove,
    });
    setCommentText(currentComment || '');
  }

  function saveComment() {
    if (commentPopup) {
      const dayData = sprint.days.find((d) => d.date === commentPopup.date);
      const devData = dayData?.developers[commentPopup.devId];
      onUpdateComment(commentPopup.devId, commentPopup.date, devData?.worked ?? 1, commentText);
      setCommentPopup(null);
    }
  }

  return (
    <div>
      {selection.size > 0 && (
        <div className="bulk-action-bar">
          <span style={{ fontWeight: 600 }}>{t('grid.selected', { count: selection.size })}</span>
          <button className="btn-primary btn-sm btn-icon" onClick={() => handleBulkAction(1)}>
            <Check size={14} /> {t('grid.markWorked')}
          </button>
          <button className="btn-danger btn-sm btn-icon" onClick={() => handleBulkAction(0)}>
            <X size={14} /> {t('grid.markAbsent')}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setSelection(new Set())}>{t('form.clear')}</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t('grid.shiftHint')}</span>
        </div>
      )}

      <div className="grid-container">
        <table className="sprint-grid" ref={tableRef} onKeyDown={handleKeyDown}>
          <thead>
            <tr>
              <th style={{ minWidth: '160px' }}>{t('grid.date')}</th>
              {developers.map((dev) => (
                <th key={dev.id} style={{ minWidth: '160px' }}>{dev.name}</th>
              ))}
              <th style={{ width: '80px' }}>{t('grid.dayTotal')}</th>
              <th style={{ width: '100px' }}>{t('grid.cumulative')}</th>
            </tr>
          </thead>
          <tbody>
            {sprint.days.map((day, rowIdx) => {
              const isTodayRow = isToday(day.date);
              const dayOfWeek = new Date(day.date + 'T00:00:00').getDay();
              const isMonday = dayOfWeek === 1 && rowIdx > 0;

              return (
                <tr
                  key={day.date}
                  ref={isTodayRow ? todayRef : null}
                  className={isMonday ? 'week-separator' : ''}
                  style={isTodayRow ? { background: 'var(--warning-light)' } : {}}
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: isTodayRow ? 700 : 500 }}>
                        {formatNumericDate(day.date, dateLocale)}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-light)' }}>{getDayName(day.date, dateLocale)}</span>
                    </div>
                    {isTodayRow && <span className="badge badge-orange" style={{ marginTop: '2px' }}>{t('grid.today')}</span>}
                  </td>

                  {developers.map((dev, colIdx) => {
                    const devDay = day.developers[dev.id];
                    if (!devDay) return <td key={dev.id}>-</td>;

                    const cellKey = `${day.date}|${dev.id}`;
                    const isSelected = selection.has(cellKey);
                    const refKey = `${rowIdx}-${colIdx}`;

                    if (devDay.inactive) {
                      return (
                        <td key={dev.id}>
                          <div className="day-cell">
                            <div className="day-toggle inactive" title={t('grid.inactive')}>&mdash;</div>
                          </div>
                        </td>
                      );
                    }

                    const isProjected = devDay.projected;
                    const worked = devDay.worked;
                    const isHalfDay = worked === 0.5;

                    // Projected + worked = default future (show ?), all others are interactive
                    const isDefaultFuture = isProjected && worked === 1;

                    const toggleClass = isDefaultFuture ? 'projected'
                      : worked === 1 ? 'worked'
                      : isHalfDay ? 'half-day'
                      : 'not-worked';

                    const baseTitle = isDefaultFuture ? t('grid.projected')
                      : worked === 1 ? t('grid.worked')
                      : isHalfDay ? t('grid.halfDay')
                      : t('grid.notWorked');
                    const toggleTitle = worked === 0 && devDay.hasEntry
                      ? `${baseTitle} · ${t('grid.clickToReset')}`
                      : baseTitle;

                    return (
                      <td key={dev.id}>
                        <div className="day-cell">
                          <div
                            ref={(el) => { cellRefs.current[refKey] = el; }}
                            tabIndex={0}
                            className={`day-toggle ${toggleClass} ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => handleCellClick(rowIdx, colIdx, day.date, dev.id, worked, devDay.comment, devDay.hasEntry, e)}
                            onFocus={() => setFocusedCell({ row: rowIdx, col: colIdx })}
                            title={toggleTitle}
                          >
                            {isDefaultFuture ? '?' : worked === 1 ? <Check size={16} /> : isHalfDay ? '½' : <X size={16} />}
                          </div>
                          {worked < 1 && (
                            <button className="btn-ghost btn-sm" onClick={(e) => openCommentPopup(day.date, dev.id, devDay.comment, e)} title={t('grid.addComment')}>
                              <MessageSquare size={14} />
                            </button>
                          )}
                          {devDay.comment && <span className="day-comment" title={devDay.comment}>{devDay.comment}</span>}
                        </div>
                      </td>
                    );
                  })}

                  <td style={{ fontWeight: 600, textAlign: 'center' }}>{day.totalWorked}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div
                          className={`progress-fill ${day.cumulativeDays >= sprint.totalDays ? 'green' : day.cumulativeDays >= sprint.totalDays * 0.7 ? 'blue' : 'orange'}`}
                          style={{ width: `${Math.min(100, (day.cumulativeDays / sprint.totalDays) * 100)}%` }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: '45px', textAlign: 'right' }}>
                        {day.cumulativeDays}/{sprint.totalDays}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {commentPopup && (
          <div ref={popupRef} className="comment-popup" style={{
            position: 'fixed',
            left: commentPopup.x,
            ...(commentPopup.above
              ? { bottom: window.innerHeight - commentPopup.y + 4 }
              : { top: commentPopup.y }),
          }}>
            <div className="comment-presets">
              {COMMENT_PRESETS.map((preset) => (
                <button key={preset} className="comment-preset" type="button" onClick={() => setCommentText(preset)}>{preset}</button>
              ))}
            </div>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder={t('grid.commentPlaceholder')} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary btn-sm" onClick={() => setCommentPopup(null)}>{t('form.cancel')}</button>
              <button className="btn-primary btn-sm" onClick={saveComment}>{t('grid.save')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
