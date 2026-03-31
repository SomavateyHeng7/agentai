import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  Bot,
  FlaskConical,
  LayoutDashboard,
  Network,
  Monitor,
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

  return (
    <div className="min-h-screen bg-shell text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r border-ink/10 bg-white/70 p-6 backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <Activity className="h-6 w-6 text-accent" />
            <h1 className="font-semibold tracking-wide">AgentFlow</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    active ? 'bg-ink text-white' : 'hover:bg-ink/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="p-6 md:p-8">
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
    </div>
  );
};
