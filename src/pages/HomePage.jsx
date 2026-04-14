import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import Modal from '../components/Modal';
import { Plus, Calendar, Users, Layers, Trash2, Download, Upload, AlertTriangle } from 'lucide-react';
import { formatDate } from '../utils/dates';
import { exportAllData, importAllData } from '../hooks/useApi';

export default function HomePage({ projects, loading, summaries, onCreateProject, onDeleteProject, onRefresh }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, dateLocale } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    daysPerSprint: 18,
    startDate: new Date().toISOString().split('T')[0],
    sprintCount: 1,
  });

  async function handleCreate(e) {
    e.preventDefault();
    const project = await onCreateProject({
      ...form,
      daysPerSprint: Number(form.daysPerSprint),
      sprintCount: Number(form.sprintCount),
    });
    setShowCreate(false);
    setForm({ name: '', clientName: '', daysPerSprint: 18, startDate: new Date().toISOString().split('T')[0], sprintCount: 1 });
    showToast(t('toast.projectCreated'));
    navigate(`/project/${project.id}`);
  }

  async function handleExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprint-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('toast.dataExported'));
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await importAllData(data);
        onRefresh();
        showToast(t('toast.dataImported'));
      } catch {
        showToast(t('toast.invalidJson'), 'error');
      }
    };
    input.click();
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{t('home.title')}</h2>
          <p>{t('home.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary btn-sm btn-icon" onClick={handleExport}>
            <Download size={16} /> {t('home.export')}
          </button>
          <button className="btn-secondary btn-sm btn-icon" onClick={handleImport}>
            <Upload size={16} /> {t('home.import')}
          </button>
          <button className="btn-primary btn-sm btn-icon" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> {t('home.newProject')}
          </button>
        </div>
      </div>

      {projects.length === 0 && !loading ? (
        <div className="empty-state">
          <Layers size={48} color="var(--text-light)" style={{ marginBottom: '1rem' }} />
          <h3>{t('home.empty.title')}</h3>
          <p style={{ marginBottom: '1rem' }}>{t('home.empty.desc')}</p>
          <button className="btn-primary btn-icon" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> {t('home.createProject')}
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => {
            const summary = (summaries || []).find((s) => s.projectId === p.id);
            return (
              <div key={p.id} className="project-card" onClick={() => navigate(`/project/${p.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.25rem' }}>{p.name}</h3>
                    {p.clientName && <span className="badge badge-purple">{p.clientName}</span>}
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(p);
                    }}
                    title={t('project.removeDev')}
                    aria-label={t('home.deleteConfirm', { name: p.name })}
                  >
                    <Trash2 size={16} color="var(--danger)" />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Calendar size={14} /> {formatDate(p.startDate, dateLocale)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Layers size={14} /> {t('home.daysPerSprint', { days: p.daysPerSprint })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Users size={14} /> {t('home.sprintCount', { count: p.sprintCount || 1 })}
                  </span>
                </div>

                {summary && summary.currentSprintNumber && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {t('home.sprintProgress', { number: summary.currentSprintNumber, pct: summary.progressPct })}
                      </span>
                      {summary.devCount > 0 && (
                        <span className="badge badge-blue" style={{ fontSize: '0.625rem' }}>
                          {t('home.devCount', { count: summary.devCount })}
                        </span>
                      )}
                    </div>
                    <div className="progress-bar" style={{ height: '6px' }}>
                      <div
                        className={`progress-fill ${summary.progressPct >= 100 ? 'green' : summary.progressPct >= 70 ? 'blue' : 'orange'}`}
                        style={{ width: `${Math.min(100, summary.progressPct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title={t('home.newProject')} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>{t('form.projectName')} *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('form.projectNamePlaceholder')}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t('form.clientName')}</label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder={t('form.clientNamePlaceholder')}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>{t('form.daysPerSprint')}</label>
                <input
                  type="number"
                  value={form.daysPerSprint}
                  onChange={(e) => setForm({ ...form, daysPerSprint: e.target.value })}
                  min="1"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label>{t('form.sprintCount')}</label>
                <input
                  type="number"
                  value={form.sprintCount}
                  onChange={(e) => setForm({ ...form, sprintCount: e.target.value })}
                  min="1"
                  max="50"
                />
              </div>
            </div>
            <div className="form-group">
              <label>{t('form.startDate')} *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>{t('form.cancel')}</button>
              <button type="submit" className="btn-primary">{t('home.createProject')}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title={t('home.deleteConfirm', { name: confirmDelete.name })} onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0' }}>
            <AlertTriangle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)' }}>
              {t('home.deleteDesc') || 'This action cannot be undone. All sprints, developers, and entries for this project will be permanently removed.'}
            </p>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>{t('form.cancel')}</button>
            <button className="btn-danger" onClick={() => {
              onDeleteProject(confirmDelete.id);
              setConfirmDelete(null);
              showToast(t('toast.projectDeleted'));
            }}>{t('home.deleteProject') || 'Delete project'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
