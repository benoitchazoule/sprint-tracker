import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDevelopers, useSprints, useEntries } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import SprintGrid from '../components/SprintGrid';
import Dashboard from '../components/Dashboard';
import Modal from '../components/Modal';
import {
  LayoutDashboard, Grid3X3, UserPlus, Trash2, Settings, CalendarPlus, GripVertical,
  ChevronLeft, ChevronRight, Pencil, ChevronDown, ChevronUp, Users,
} from 'lucide-react';
import { formatShortDate } from '../utils/dates';

export default function ProjectPage({ projects, onUpdateProject }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === projectId);
  const { showToast } = useToast();
  const { t, dateLocale } = useI18n();

  const { developers, setDevelopers, fetchDevelopers, addDeveloper, updateDeveloper, removeDeveloper, reorderDevelopers } = useDevelopers(projectId);
  const { sprints, loading: sprintsLoading, fetchSprints } = useSprints(projectId);
  const { setEntry, setBulkEntries, removeEntry } = useEntries(projectId);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSprint, setActiveSprint] = useState(-1);

  // Reset to dashboard view when switching projects
  useEffect(() => {
    setActiveTab('dashboard');
    setActiveSprint(-1);
  }, [projectId]);
  const [showAddDev, setShowAddDev] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevStartDate, setNewDevStartDate] = useState('');
  const [newDevEndDate, setNewDevEndDate] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [editingDev, setEditingDev] = useState(null);
  const [devsExpanded, setDevsExpanded] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [confirmRemoveDev, setConfirmRemoveDev] = useState(null);
  const [dragDevId, setDragDevId] = useState(null);
  const sprintTabsRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const refresh = useCallback(() => {
    fetchDevelopers();
    fetchSprints();
  }, [fetchDevelopers, fetchSprints]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-select current sprint when sprints load
  useEffect(() => {
    if (sprints.length > 0 && activeSprint === -1) {
      const today = new Date().toISOString().split('T')[0];
      const currentIdx = sprints.findIndex((s) => s.startDate <= today && s.endDate >= today);
      setActiveSprint(currentIdx >= 0 ? currentIdx : sprints.length - 1);
    }
  }, [sprints, activeSprint]);

  const updateScrollArrows = useCallback(() => {
    const el = sprintTabsRef.current;
    if (!el) return;
    const threshold = 2;
    setCanScrollLeft(el.scrollLeft > threshold);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - threshold);
  }, []);

  const sprintTabsCallbackRef = useCallback((node) => {
    sprintTabsRef.current = node;
    if (node) {
      requestAnimationFrame(updateScrollArrows);
    }
  }, [updateScrollArrows]);

  useEffect(() => {
    if (sprintTabsRef.current) {
      const activeEl = sprintTabsRef.current.querySelector('.sprint-tab.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      setTimeout(updateScrollArrows, 150);
    }
  }, [activeSprint, updateScrollArrows]);

  useEffect(() => {
    const el = sprintTabsRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollArrows);
    const observer = new ResizeObserver(updateScrollArrows);
    observer.observe(el);
    updateScrollArrows();
    return () => {
      el.removeEventListener('scroll', updateScrollArrows);
      observer.disconnect();
    };
  }, [sprints, activeTab, updateScrollArrows]);

  function scrollSprintTabs(direction) {
    const el = sprintTabsRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 150, behavior: 'smooth' });
    setTimeout(updateScrollArrows, 300);
  }

  if (!project) {
    return (
      <div className="empty-state">
        <h3>{t('project.notFound')}</h3>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('project.goBack')}</button>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  function getSprintStatus(sprint) {
    const consumed = sprint.days
      .filter((d) => d.date <= today)
      .reduce((sum, d) => sum + d.totalWorked, 0);
    const effectiveTarget = sprint.effectiveTarget ?? sprint.totalDays;
    const pct = effectiveTarget > 0 ? (consumed / effectiveTarget) * 100 : 0;
    if (pct >= 100 || sprint.endDate < today) return 'done';
    if (sprint.startDate <= today && sprint.endDate >= today) return 'current';
    return 'future';
  }

  const statusDotColors = { done: 'var(--success)', current: 'var(--primary)', future: 'var(--text-light)' };

  async function handleToggleDay(devId, date, worked, comment, prevWorked) {
    await setEntry({ developerId: devId, date, worked, comment });
    fetchSprints();
    if (prevWorked !== undefined) {
      showToast(t('toast.dayUpdated'), 'success', () => {
        setEntry({ developerId: devId, date, worked: prevWorked, comment });
        fetchSprints();
      });
    } else {
      showToast(t('toast.dayUpdated'));
    }
  }

  async function handleResetDay(devId, date, prevWorked, prevComment) {
    await removeEntry({ developerId: devId, date });
    fetchSprints();
    showToast(t('toast.dayReset'), 'success', () => {
      setEntry({ developerId: devId, date, worked: prevWorked, comment: prevComment || '' });
      fetchSprints();
    });
  }

  async function handleUpdateComment(devId, date, worked, comment) {
    await setEntry({ developerId: devId, date, worked, comment });
    fetchSprints();
    showToast(t('toast.commentSaved'));
  }

  async function handleAddDev(e) {
    e.preventDefault();
    if (newDevName.trim()) {
      await addDeveloper({
        name: newDevName.trim(),
        startDate: newDevStartDate || undefined,
        endDate: newDevEndDate || undefined,
      });
      setNewDevName('');
      setNewDevStartDate('');
      setNewDevEndDate('');
      setShowAddDev(false);
      fetchSprints();
      showToast(t('toast.devAdded'));
    }
  }

  async function handleUpdateDev(id, updates) {
    await updateDeveloper(id, updates);
    setEditingDev(null);
    fetchSprints();
    showToast(t('toast.devUpdated'));
  }

  async function handleRemoveDev(devId) {
    await removeDeveloper(devId);
    fetchSprints();
    setConfirmRemoveDev(null);
    showToast(t('toast.devRemoved'));
  }

  async function handleUpdateSettings(updates) {
    await onUpdateProject(project.id, updates);
    setShowSettings(false);
    fetchSprints();
    showToast(t('toast.settingsSaved'));
  }

  async function handleAddEvent({ name, startDate, endDate, developerIds }) {
    // Generate entries for selected developers across all weekdays in the range
    const entries = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const selectedDevs = developers.filter((d) => developerIds.includes(d.id));

    while (current <= end) {
      const dow = current.getDay();
      if (dow !== 0 && dow !== 6) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        for (const dev of selectedDevs) {
          // Only for developers active on that date
          const activeStart = !dev.startDate || dateStr >= dev.startDate;
          const activeEnd = !dev.endDate || dateStr <= dev.endDate;
          if (activeStart && activeEnd) {
            entries.push({ developerId: dev.id, date: dateStr, worked: 0, comment: name });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (entries.length > 0) {
      await setBulkEntries(entries);
      fetchSprints();
      showToast(t('toast.eventAdded'));
    }
    setShowAddEvent(false);
  }

  function handleDragStart(devId) {
    setDragDevId(devId);
  }

  function handleDragOver(e, targetDevId) {
    e.preventDefault();
    if (!dragDevId || dragDevId === targetDevId) return;
    // Reorder locally for instant visual feedback
    setDevelopers((prev) => {
      const fromIdx = prev.findIndex((d) => d.id === dragDevId);
      const toIdx = prev.findIndex((d) => d.id === targetDevId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated;
    });
  }

  function handleDragEnd() {
    if (dragDevId) {
      // Persist the new order
      reorderDevelopers(developers.map((d) => d.id));
      fetchSprints();
    }
    setDragDevId(null);
  }

  return (
    <div>
      {/* ── Sticky toolbar ── */}
      <div className="project-toolbar">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {project.name}
            </h2>
            {project.clientName && (
              <span className="badge badge-purple">{project.clientName}</span>
            )}
          </div>
        </div>

        <div className="project-toolbar-divider" />

        <button
          className={`btn-sm btn-icon ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={14} /> {t('project.dashboard')}
        </button>
        <button
          className={`btn-sm btn-icon ${activeTab === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('grid');
            // Navigate to current sprint
            const today = new Date().toISOString().split('T')[0];
            const currentIdx = sprints.findIndex((s) => s.startDate <= today && s.endDate >= today);
            if (currentIdx >= 0) setActiveSprint(currentIdx);
          }}
        >
          <Grid3X3 size={14} /> {t('project.grid')}
        </button>

        <div className="project-toolbar-divider" />

        <button className="btn-ghost btn-sm btn-icon" onClick={() => setShowAddEvent(true)} title={t('event.addEvent')}>
          <CalendarPlus size={14} />
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setShowSettings(true)} title={t('project.settings')}>
          <Settings size={14} />
        </button>
      </div>

      {/* ── Team section ── */}
      <div className="developers-section">
        <div className="developers-section-header" onClick={() => setDevsExpanded(!devsExpanded)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={14} />
            {t('project.team', { count: developers.length })}
          </span>
          {devsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {devsExpanded && (
          <div className="developers-section-body fade-in">
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {developers.map((dev) => (
                <div
                  key={dev.id}
                  draggable
                  onDragStart={() => handleDragStart(dev.id)}
                  onDragOver={(e) => handleDragOver(e, dev.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: dragDevId === dev.id ? 'var(--primary-light)' : 'var(--bg)',
                    border: dragDevId === dev.id ? '1px dashed var(--primary)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8125rem',
                    cursor: 'grab',
                    opacity: dragDevId === dev.id ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <GripVertical size={14} color="var(--text-light)" style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500 }}>{dev.name}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-light)' }}>
                      {dev.startDate ? formatShortDate(dev.startDate, dateLocale) : t('form.startDate')} &rarr; {dev.endDate ? formatShortDate(dev.endDate, dateLocale) : t('project.present')}
                    </span>
                  </div>
                  <button className="btn-ghost" style={{ padding: '0.125rem' }} onClick={() => setEditingDev(dev)} title={t('project.editDates')}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-ghost" style={{ padding: '0.125rem' }} onClick={() => setConfirmRemoveDev(dev)} title={t('project.removeDev')}>
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </div>
              ))}
              <button
                className="add-dev-btn"
                ref={(el) => { if (el) el.style.width = el.offsetHeight + 'px'; }}
                onClick={() => { setNewDevStartDate(project.startDate); setShowAddDev(true); }}
                title={t('project.addDev')}
              >
                <UserPlus size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {activeTab === 'dashboard' && (
        <div className="fade-in">
          <Dashboard project={project} sprints={sprints} developers={developers} />
        </div>
      )}

      {activeTab === 'grid' && (
        <div className="fade-in">
          {sprints.length > 0 && (
            <div className="sprint-nav">
              <div className="sprint-nav-tabs">
                {canScrollLeft && (
                  <button className="btn-ghost btn-sm" onClick={() => scrollSprintTabs(-1)} style={{ padding: '0.25rem', flexShrink: 0 }}>
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div className="sprint-tabs" ref={sprintTabsCallbackRef}>
                  {sprints.map((s, i) => {
                    const status = getSprintStatus(s);
                    return (
                      <button key={i} className={`sprint-tab ${activeSprint === i ? 'active' : ''}`} onClick={() => setActiveSprint(i)}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: activeSprint === i ? '#fff' : statusDotColors[status], marginRight: '0.375rem', flexShrink: 0 }} />
                        {s.number}
                      </button>
                    );
                  })}
                </div>
                {canScrollRight && (
                  <button className="btn-ghost btn-sm" onClick={() => scrollSprintTabs(1)} style={{ padding: '0.25rem', flexShrink: 0 }}>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>

              {sprints[activeSprint] && (
                <div className="sprint-nav-meta">
                  <span style={{ color: 'var(--text-light)', fontSize: 'var(--text-xs)' }}>
                    {sprints[activeSprint].startDate} &rarr; {sprints[activeSprint].endDate}
                  </span>
                  <span className="badge badge-blue">
                    {t('sprint.days', { consumed: sprints[activeSprint].daysConsumed, target: sprints[activeSprint].effectiveTarget ?? sprints[activeSprint].totalDays })}
                  </span>
                  {sprints[activeSprint].carryOver !== 0 && sprints[activeSprint].carryOver != null && (
                    <span className={`badge ${sprints[activeSprint].carryOver > 0 ? 'badge-red' : 'badge-green'}`}>
                      {t('sprint.fromPrev', { value: (sprints[activeSprint].carryOver > 0 ? '+' : '') + sprints[activeSprint].carryOver })}
                    </span>
                  )}
                  {sprints[activeSprint].delta !== 0 && sprints[activeSprint].delta != null && (
                    <span className={`badge ${sprints[activeSprint].delta > 0 ? 'badge-red' : 'badge-green'}`}>
                      {t('sprint.delta', { value: (sprints[activeSprint].delta > 0 ? '+' : '') + sprints[activeSprint].delta })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {sprints[activeSprint] && (
            <div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <SprintGrid
                  sprint={sprints[activeSprint]}
                  developers={developers.filter((dev) => {
                    const s = sprints[activeSprint];
                    // Keep developer if their active period overlaps with the sprint
                    if (dev.endDate && dev.endDate < s.startDate) return false;
                    if (dev.startDate && dev.startDate > s.endDate) return false;
                    return true;
                  })}
                  onToggleDay={handleToggleDay}
                  onUpdateComment={handleUpdateComment}
                  onResetDay={handleResetDay}
                />
              </div>
            </div>
          )}

          {sprints.length === 0 && (
            <div className="empty-state">
              <h3>{t('grid.noSprints')}</h3>
              <p>{t('grid.noSprintsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddDev && (
        <Modal title={t('project.addDev')} onClose={() => setShowAddDev(false)}>
          <form onSubmit={handleAddDev}>
            <div className="form-group">
              <label>{t('form.devName')}</label>
              <input type="text" value={newDevName} onChange={(e) => setNewDevName(e.target.value)} placeholder={t('form.devNamePlaceholder')} autoFocus />
            </div>
            <div className="form-group">
              <label>{t('form.startDate')}</label>
              <input type="date" value={newDevStartDate} onChange={(e) => setNewDevStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('form.endDate')} <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>{t('form.endDateHint')}</span></label>
              <input type="date" value={newDevEndDate} onChange={(e) => setNewDevEndDate(e.target.value)} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowAddDev(false)}>{t('form.cancel')}</button>
              <button type="submit" className="btn-primary">{t('project.addDev')}</button>
            </div>
          </form>
        </Modal>
      )}

      {editingDev && (
        <DevEditModal dev={editingDev} t={t} onSave={(updates) => handleUpdateDev(editingDev.id, updates)} onClose={() => setEditingDev(null)} />
      )}

      {showSettings && (
        <SettingsModal project={project} t={t} onSave={handleUpdateSettings} onClose={() => setShowSettings(false)} />
      )}

      {showAddEvent && (
        <EventModal t={t} developers={developers} onSave={handleAddEvent} onClose={() => setShowAddEvent(false)} />
      )}

      {confirmRemoveDev && (
        <Modal title={t('confirm.removeDev')} onClose={() => setConfirmRemoveDev(null)}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
            {t('confirm.removeDevDesc') || `Remove ${confirmRemoveDev.name} from this project? Their time entries will be deleted.`}
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConfirmRemoveDev(null)}>{t('form.cancel')}</button>
            <button className="btn-danger" onClick={() => handleRemoveDev(confirmRemoveDev.id)}>{t('project.removeDev')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EventModal({ t, developers, onSave, onClose }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDevs, setSelectedDevs] = useState(() => new Set(developers.map((d) => d.id)));

  function toggleDev(id) {
    setSelectedDevs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedDevs.size === developers.length) {
      setSelectedDevs(new Set());
    } else {
      setSelectedDevs(new Set(developers.map((d) => d.id)));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim() && startDate && endDate && endDate >= startDate && selectedDevs.size > 0) {
      onSave({ name: name.trim(), startDate, endDate, developerIds: [...selectedDevs] });
    }
  }

  return (
    <Modal title={t('event.title')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('event.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('event.namePlaceholder')}
            required
            autoFocus
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>{t('event.startDate')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('event.endDate')}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required />
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t('event.developers')}
            <button
              type="button"
              className="btn-ghost btn-sm"
              style={{ fontSize: '0.6875rem', textTransform: 'none', letterSpacing: 0 }}
              onClick={toggleAll}
            >
              {selectedDevs.size === developers.length ? t('event.deselectAll') : t('event.selectAll')}
            </button>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.25rem' }}>
            {developers.map((dev) => (
              <label
                key={dev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.5rem',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: selectedDevs.has(dev.id) ? 'var(--primary-light)' : 'var(--bg)',
                  border: selectedDevs.has(dev.id) ? '1px solid var(--primary)' : '1px solid var(--border)',
                  fontSize: '0.8125rem',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedDevs.has(dev.id)}
                  onChange={() => toggleDev(dev.id)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={{ fontWeight: 500 }}>{dev.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('form.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={selectedDevs.size === 0}>{t('event.add')}</button>
        </div>
      </form>
    </Modal>
  );
}

function DevEditModal({ dev, t, onSave, onClose }) {
  const [startDate, setStartDate] = useState(dev.startDate || '');
  const [endDate, setEndDate] = useState(dev.endDate || '');

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ startDate: startDate || null, endDate: endDate || null });
  }

  return (
    <Modal title={`${dev.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('form.startDate')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('form.endDate')} <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>{t('form.endDateHint')}</span></label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ flex: 1 }} />
            {endDate && <button type="button" className="btn-secondary btn-sm" onClick={() => setEndDate('')}>{t('form.clear')}</button>}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('form.cancel')}</button>
          <button type="submit" className="btn-primary">{t('form.save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsModal({ project, t, onSave, onClose }) {
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName || '');
  const [daysPerSprint, setDaysPerSprint] = useState(project.daysPerSprint || 18);
  const [sprintCount, setSprintCount] = useState(project.sprintCount || 1);
  const [startDate, setStartDate] = useState(project.startDate);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ name, clientName, daysPerSprint: Number(daysPerSprint), sprintCount: Number(sprintCount), startDate });
  }

  return (
    <Modal title={t('form.projectSettings')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>{t('form.projectName')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{t('form.clientName')}</label>
          <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t('form.optional')} />
        </div>
        <div className="form-group">
          <label>{t('form.daysPerSprint')}</label>
          <input type="number" value={daysPerSprint} onChange={(e) => setDaysPerSprint(e.target.value)} min="1" max="100" />
        </div>
        <div className="form-group">
          <label>{t('form.sprintCount')}</label>
          <input type="number" value={sprintCount} onChange={(e) => setSprintCount(e.target.value)} min="1" max="50" />
        </div>
        <div className="form-group">
          <label>{t('form.startDate')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('form.cancel')}</button>
          <button type="submit" className="btn-primary">{t('form.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
