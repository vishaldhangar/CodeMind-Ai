import { AppProvider, useApp } from './AppContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import AIAssistant from './components/AIAssistant';
import LoadingState from './components/LoadingState';

// Pages
import OverviewPage       from './pages/OverviewPage';
import ArchitecturePage   from './pages/ArchitecturePage';
import WorkflowsPage      from './pages/WorkflowsPage';
import RoutesPage         from './pages/RoutesPage';
import DatabasePage       from './pages/DatabasePage';
import ImpactPage         from './pages/ImpactPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';

import DependencyPage from './pages/DependencyPage';

const PAGE_MAP = {
  overview:     <OverviewPage />,
  architecture: <ArchitecturePage />,
  workflows:    <WorkflowsPage />,
  dependency:   <DependencyPage />,
  knowledge:    <KnowledgeGraphPage />,
  routes:       <RoutesPage />,
  database:     <DatabasePage />,
  impact:       <ImpactPage />,
  assistant:    <OverviewPage />,
};

function AppShell() {
  // activePage/setActivePage now lives in context — any component can navigate
  const { activePage, activeRepo, loading, analyzing } = useApp();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        {!activeRepo ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20
          }}>
            <span style={{ fontSize: 64 }}>🧠</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Welcome to CodeMind AI
            </div>
            <div style={{ fontSize: '0.9rem', maxWidth: 420, textAlign: 'center', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              Import a GitHub repository from the sidebar to start exploring architecture,
              workflows, knowledge graphs, and chat with your codebase.
            </div>
          </div>
        ) : (loading || analyzing) ? (
          <LoadingState />
        ) : (
          PAGE_MAP[activePage] || PAGE_MAP.overview
        )}
      </div>
      <AIAssistant />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
