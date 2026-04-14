import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useProjects, useProjectSummaries } from './hooks/useApi';
import { ToastProvider } from './components/Toast';
import { I18nProvider, useI18n, LOCALES } from './i18n';
import { useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import ProjectPage from './pages/ProjectPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UserMenu from './components/UserMenu';
import { LayoutDashboard, FolderOpen, Zap, Plus, ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from './components/Modal';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { projects, loading, fetchProjects, createProject, updateProject, deleteProject } = useProjects();
  const { summaries, fetchSummaries } = useProjectSummaries();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [showSidebarCreate, setShowSidebarCreate] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(() => localStorage.getItem('projects-expanded') !== 'false');
  const [sidebarForm, setSidebarForm] = useState({
    name: '',
    daysPerSprint: 18,
    startDate: new Date().toISOString().split('T')[0],
    sprintCount: 1,
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('projects-expanded', projectsExpanded);
  }, [projectsExpanded]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchSummaries();
    }
  }, [user, fetchProjects, fetchSummaries]);

  useEffect(() => {
    if (user) {
      fetchSummaries();
    }
  }, [location.pathname, user, fetchSummaries]);

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  if (authLoading) {
    return <div className="auth-loading"><Zap size={32} color="var(--primary)" /><p>{t('auth.loading')}</p></div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Redirect to dashboard if still on auth pages after login
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return <Navigate to="/" replace />;
  }

  async function handleSidebarCreate(e) {
    e.preventDefault();
    const project = await createProject({
      ...sidebarForm,
      daysPerSprint: Number(sidebarForm.daysPerSprint),
      sprintCount: Number(sidebarForm.sprintCount),
    });
    setShowSidebarCreate(false);
    setSidebarForm({ name: '', daysPerSprint: 18, startDate: new Date().toISOString().split('T')[0], sprintCount: 1 });
    fetchProjects();
    fetchSummaries();
    if (project?.id) navigate(`/project/${project.id}`);
  }

  return (
    <div className="app-layout">
      <button className={`sidebar-collapse-btn ${sidebarCollapsed ? 'sidebar-collapse-btn-collapsed' : ''}`} onClick={toggleSidebar} title={sidebarCollapsed ? t('nav.expandSidebar') || 'Expand' : t('nav.collapseSidebar') || 'Collapse'}>
        {sidebarCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
      </button>
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1><Zap size={20} style={{ flexShrink: 0 }} /><span className="sidebar-label">{t('app.title')}</span></h1>
        </div>

        <nav className="sidebar-nav">
          <Link to="/" data-tooltip={t('nav.allProjects')} className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> <span className="sidebar-label">{t('nav.allProjects')}</span>
          </Link>

          <div className="sidebar-menu-group">
            <div className="sidebar-parent-row">
              <button
                className={`sidebar-link sidebar-link-parent ${projects.some((p) => location.pathname.includes(p.id)) ? 'has-active-child' : ''}`}
                data-tooltip={t('nav.projects')}
                onClick={() => setProjectsExpanded((prev) => !prev)}
              >
                <FolderOpen size={18} />
                <span className="sidebar-label" style={{ flex: 1, textAlign: 'left' }}>{t('nav.projects')}</span>
                <span className="sidebar-label sidebar-chevron">
                  {projectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>
            </div>

            {projectsExpanded && (
              <div className="sidebar-submenu">
                <button
                  className="sidebar-link sidebar-sublink sidebar-add-project-btn"
                  onClick={() => setShowSidebarCreate(true)}
                  title={t('home.newProject')}
                >
                  <Plus size={14} />
                  <span className="sidebar-label">{t('home.newProject')}</span>
                </button>
                {projects.map((p) => {
                  const summary = summaries.find((s) => s.projectId === p.id);
                  return (
                    <Link
                      key={p.id}
                      to={`/project/${p.id}`}
                      data-tooltip={p.name}
                      className={`sidebar-link sidebar-sublink ${location.pathname.includes(p.id) ? 'active' : ''}`}
                    >
                      <span className="sidebar-project-initial">
                        {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="sidebar-label" style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {p.name}
                        </span>
                        {summary && summary.currentSprintNumber && (
                          <div className="sidebar-progress">
                            <span>{t('sprint.sprint', { number: summary.currentSprintNumber })} &mdash; {summary.progressPct}%</span>
                            <div className="sidebar-progress-bar">
                              <div
                                className="sidebar-progress-fill"
                                style={{
                                  width: `${summary.progressPct}%`,
                                  background: summary.progressPct >= 100 ? 'var(--success)' : 'var(--primary)',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <UserMenu
            user={user}
            theme={theme}
            locale={locale}
            locales={LOCALES}
            onToggleTheme={toggleTheme}
            onSetLocale={setLocale}
            onLogout={handleLogout}
            t={t}
            collapsed={sidebarCollapsed}
          />
        </div>
      </aside>

      {showSidebarCreate && (
        <Modal title={t('home.newProject')} onClose={() => setShowSidebarCreate(false)}>
          <form onSubmit={handleSidebarCreate}>
            <div className="form-group">
              <label>{t('form.projectName')} *</label>
              <input type="text" value={sidebarForm.name} onChange={(e) => setSidebarForm({ ...sidebarForm, name: e.target.value })} placeholder={t('form.projectNamePlaceholder')} required autoFocus />
            </div>
            <div className="form-group">
              <label>{t('form.startDate')} *</label>
              <input type="date" value={sidebarForm.startDate} onChange={(e) => setSidebarForm({ ...sidebarForm, startDate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>{t('form.daysPerSprint')} *</label>
              <input type="number" min="1" value={sidebarForm.daysPerSprint} onChange={(e) => setSidebarForm({ ...sidebarForm, daysPerSprint: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>{t('form.sprintCount')} *</label>
              <input type="number" min="1" value={sidebarForm.sprintCount} onChange={(e) => setSidebarForm({ ...sidebarForm, sprintCount: e.target.value })} required />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSidebarCreate(false)}>{t('form.cancel')}</button>
              <button type="submit" className="btn-primary">{t('home.createProject')}</button>
            </div>
          </form>
        </Modal>
      )}

      <main className={`main-content ${sidebarCollapsed ? 'main-content-expanded' : ''}`}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                projects={projects}
                loading={loading}
                summaries={summaries}
                onCreateProject={createProject}
                onDeleteProject={deleteProject}
                onRefresh={() => { fetchProjects(); fetchSummaries(); }}
              />
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProjectPage
                projects={projects}
                onUpdateProject={updateProject}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </ToastProvider>
  );
}
