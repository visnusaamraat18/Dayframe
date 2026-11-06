import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare2,
  Flame,
  NotebookPen,
  ChartNoAxesCombined,
  Settings2,
  Plus,
  ArrowUpRight,
  Command,
  PanelLeftClose,
  Menu,
  X,
  Bell,
  Moon,
  Sun,
  ChevronRight,
  ShieldCheck,
  CircleHelp,
  FlaskConical,
} from 'lucide-react';
import { AppProvider, useApp } from './hooks/useApp';
import { Capture } from './components/Editors';
import { Empty } from './components/ui';
import { savePreferences } from './database/repository';
import { taskRows } from './services/calculations';
import Today from './pages/Today';
import Tasks from './pages/Tasks';
import Habits from './pages/Habits';
import Notes from './pages/Notes';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
const navigation = [
  { path: '/', label: 'Today', icon: LayoutDashboard },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { path: '/habits', label: 'Habits', icon: Flame },
  { path: '/notes', label: 'Notes & Lists', icon: NotebookPen },
  { path: '/insights', label: 'Insights', icon: ChartNoAxesCombined },
];
function Shell() {
  const { data, prefs, today, loading, error, run } = useApp(),
    location = useLocation();
  const [capture, setCapture] = useState(false),
    [mobile, setMobile] = useState(false),
    [help, setHelp] = useState(false);
  const activeTasks = taskRows(data).filter((r) => !r.done).length;
  const demo = [...data.tasks, ...data.habits, ...data.notes, ...data.checklists].some(
    (r) => r.demo,
  );
  const pageName =
    location.pathname === '/settings'
      ? 'Settings'
      : (navigation.find((n) => n.path === location.pathname)?.label ?? 'Your workspace');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCapture((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
    document.title = `${pageName} · DAYFRAME`;
  }, [location.pathname, pageName]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            D<ArrowUpRight size={16} />
          </span>
          <span>
            DAYFRAME<small>A LITTLE MORE INTENTION.</small>
          </span>
        </Link>
        <button
          className="icon-btn mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <button
          className="sidebar-capture"
          onClick={() => {
            setCapture(true);
            setMobile(false);
          }}
        >
          <Plus size={17} />
          Quick capture
          <span>
            <Command size={10} />K
          </span>
        </button>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <NavLink
              to={n.path}
              end={n.path === '/'}
              key={n.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <n.icon size={18} strokeWidth={1.6} />
              <span>{n.label}</span>
              {n.path === '/tasks' && activeTasks > 0 && <small>{activeTasks}</small>}
              {n.path === '/' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>
              <Flame size={20} strokeWidth={1.5} />
            </span>
            <h3>
              Your pace.
              <br />
              Your progress.
            </h3>
            <p>A little better is still better.</p>
            <Link to="/insights">
              See your journey
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            to="/settings"
          >
            <Settings2 size={18} strokeWidth={1.6} />
            <span>Settings</span>
          </NavLink>
          <button className="nav-item help-link" onClick={() => setHelp(!help)}>
            <CircleHelp size={18} strokeWidth={1.6} />
            <span>A little help</span>
            <ChevronRight size={13} />
          </button>
          {help && (
            <div className="help-note">
              <p>
                Capture a task with <kbd>Ctrl K</kbd>. Use Tasks to plan, Habits to check in, and
                Settings to back up your workspace.
              </p>
              <p>
                Python saves your data in the local SQLite database. Demo examples are optional in
                Settings.
              </p>
            </div>
          )}
          <div className="workspace-profile">
            <span className="workspace-avatar">
              Y<span />
            </span>
            <div>
              <strong>Your workspace</strong>
              <small>Local & personal</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <PanelLeftClose size={17} className="desktop-sidebar-icon" />
            <span>Your workspace</span>
            <ChevronRight size={12} />
            <strong>{pageName}</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">
              {new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric',
              })}
              <span className="topbar-divider" />
            </span>
            <button
              className="icon-btn"
              aria-label="Toggle light or dark theme"
              title="Switch appearance"
              onClick={() =>
                run(() =>
                  savePreferences({
                    theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
                  }),
                )
              }
            >
              {prefs.theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link
              className="icon-btn notification-link"
              aria-label="Reminder settings"
              to="/settings"
            >
              <Bell size={17} />
              {prefs.notifications && <span />}
            </Link>
            <span className="topbar-avatar">Y</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <FlaskConical size={14} />
            <span>Demonstration data is included. Fictional records are labeled Demo.</span>
            <Link to="/settings">
              Manage demo
              <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
        <main id="main-content" className="main-content">
          {error ? (
            <div className="storage-error" role="alert">
              <h1>We couldn’t open your local workspace.</h1>
              <p>{error}</p>
              <p>
                Start python serve_dayframe.py from the DAYFRAME folder, then refresh. Your records
                are stored in the local SQLite database.
              </p>
              <button className="btn primary" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="loading-screen">
              <span className="brand-mark">D</span>
              <p>Making a little room for your day…</p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Today onCapture={() => setCapture(true)} />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/habits" element={<Habits />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="Let’s find your way back."
                    text="This page isn’t part of your workspace."
                    action="Back to today"
                    onAction={() => {
                      window.location.href = '/';
                    }}
                  />
                }
              />
            </Routes>
          )}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        {navigation.slice(0, 4).map((n) => (
          <NavLink end={n.path === '/'} to={n.path} key={n.path}>
            <n.icon size={19} />
            <span>{n.label === 'Notes & Lists' ? 'Notes' : n.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setCapture(true)} aria-label="Quick capture">
          <Plus size={23} />
          <span>Capture</span>
        </button>
      </nav>
      {capture && <Capture onClose={() => setCapture(false)} />}
    </div>
  );
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DAYFRAME interface error', error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="storage-error">
        <h1>A little interruption.</h1>
        <p>{this.state.error}</p>
        <p>
          Your saved records are kept in the local SQLite database. Refresh to reopen the workspace.
        </p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Refresh DAYFRAME
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <Shell />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
