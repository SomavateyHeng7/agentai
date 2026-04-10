import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Command,
  FlaskConical,
  LayoutDashboard,
  Network,
  Monitor,
  Search,
  TestTube2,
  Settings,
} from 'lucide-react';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { ABTestsPage } from './pages/ABTestsPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { SettingsPage } from './pages/SettingsPage';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/workflows', label: 'Workflows', icon: Network },
  { to: '/ab-tests', label: 'A/B Tests', icon: FlaskConical },
  { to: '/playground', label: 'Playground', icon: TestTube2 },
  { to: '/monitoring', label: 'Monitoring', icon: Monitor },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  const currentSection = navItems.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  const currentIndex = currentSection
    ? navItems.findIndex((item) => item.to === currentSection.to)
    : 0;

  const previousItem = currentIndex > 0 ? navItems[currentIndex - 1] : navItems[navItems.length - 1];
  const nextItem = currentIndex < navItems.length - 1 ? navItems[currentIndex + 1] : navItems[0];

  const filteredNavItems = useMemo(() => {
    const normalized = quickQuery.trim().toLowerCase();
    if (!normalized) {
      return navItems;
    }

    return navItems.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [quickQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

      if (isCommandPalette) {
        event.preventDefault();
        setQuickNavOpen((open) => !open);
        return;
      }

      if (event.key === 'Escape') {
        setQuickNavOpen(false);
      }

      if (!quickNavOpen && event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(previousItem.to);
      }

      if (!quickNavOpen && event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        navigate(nextItem.to);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, nextItem.to, previousItem.to, quickNavOpen]);

  const onQuickJump = (to: string): void => {
    navigate(to);
    setQuickNavOpen(false);
    setQuickQuery('');
  };

  const onQuickInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    if (filteredNavItems.length > 0) {
      onQuickJump(filteredNavItems[0].to);
    }
  };

  return (
    <div className="dashboard-shell min-h-screen text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/80 to-transparent" />

      <div className="mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 gap-4 p-3 md:grid-cols-[280px_1fr] md:gap-6 md:p-6">
        <aside className="hidden rounded-3xl border border-ink/10 bg-white/70 p-6 shadow-sm backdrop-blur md:sticky md:top-6 md:block md:h-[calc(100vh-3rem)]">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-ink p-2 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide">AgentFlow</h1>
              <p className="text-xs text-ink/55">Operations Console</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                    active
                      ? 'bg-ink text-white shadow-[0_10px_24px_rgba(13,27,42,0.25)]'
                      : 'hover:bg-ink/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-ink/10 bg-white/70 p-3 text-xs text-ink/65">
            <p className="font-medium text-ink/80">Tip</p>
            <p className="mt-1">Use `Workflows` to replay branches and inspect live execution traces.</p>
          </div>
        </aside>

        <main className="relative rounded-3xl border border-ink/10 bg-white/65 p-4 shadow-sm backdrop-blur md:p-6">
          <header className="mb-4 hidden items-center justify-between rounded-2xl border border-ink/10 bg-white/80 p-3 md:flex">
            <div className="flex items-center gap-2 text-sm text-ink/70">
              <span className="rounded-full bg-ink/5 px-2 py-1 text-xs">Section</span>
              <span className="font-medium text-ink">{currentSection?.label || 'Dashboard'}</span>
              <span className="text-ink/40">/</span>
              <span className="text-xs text-ink/55">Use `Cmd/Ctrl + K` to jump</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(previousItem.to)}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 hover:bg-shell"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {previousItem.label}
              </button>

              <button
                type="button"
                onClick={() => setQuickNavOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 hover:bg-shell"
              >
                <Command className="h-3.5 w-3.5" />
                Quick Jump
              </button>

              <button
                type="button"
                onClick={() => navigate(nextItem.to)}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 hover:bg-shell"
              >
                {nextItem.label}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <header className="mb-4 rounded-2xl border border-ink/10 bg-white/80 p-3 md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                <span className="text-sm font-semibold tracking-wide">AgentFlow</span>
              </div>
              <span className="rounded-full bg-ink/5 px-2 py-1 text-xs text-ink/65">
                {currentSection?.label || 'Dashboard'}
              </span>
            </div>

            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => navigate(previousItem.to)}
                className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {previousItem.label}
              </button>
              <button
                type="button"
                onClick={() => navigate(nextItem.to)}
                className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70"
              >
                {nextItem.label}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <Link
                    key={`mobile-${item.to}`}
                    to={item.to}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? 'bg-ink text-white' : 'bg-ink/5 text-ink/70'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <Routes>
            <Route path="/" element={<DashboardHomePage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/:agentId" element={<AgentDetailPage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/ab-tests" element={<ABTestsPage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {quickNavOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-24 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-ink/15 bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-ink/15 bg-shell/70 px-3 py-2">
              <Search className="h-4 w-4 text-ink/60" />
              <input
                autoFocus
                value={quickQuery}
                onChange={(event) => setQuickQuery(event.target.value)}
                onKeyDown={onQuickInputKeyDown}
                placeholder="Jump to Dashboard, Workflows, Monitoring..."
                className="w-full border-none bg-transparent text-sm outline-none"
              />
            </div>
            <ul className="max-h-64 space-y-1 overflow-auto">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const active = currentSection?.to === item.to;

                return (
                  <li key={`quick-${item.to}`}>
                    <button
                      type="button"
                      onClick={() => onQuickJump(item.to)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                        active ? 'bg-ink text-white' : 'hover:bg-ink/5'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className={`text-[11px] ${active ? 'text-white/75' : 'text-ink/50'}`}>{item.to}</span>
                    </button>
                  </li>
                );
              })}
              {filteredNavItems.length === 0 ? (
                <li className="px-3 py-3 text-sm text-ink/60">No sections match your search.</li>
              ) : null}
            </ul>
            <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-ink/55">
              <span>Press Enter to open first match</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
