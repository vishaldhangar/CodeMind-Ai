import { useState } from 'react';
import { useApp } from '../AppContext';

const NAV_ITEMS = [
  { id: 'overview',      icon: '⊞', label: 'Overview' },
  { id: 'architecture',  icon: '🏗', label: 'Architecture' },
  { id: 'workflows',     icon: '⚡', label: 'Workflows' },
  { id: 'dependency',    icon: '🔗', label: 'Dependency Graph' },
  { id: 'knowledge',     icon: '🕸', label: 'Knowledge Graph' },
  { id: 'routes',        icon: '🛤', label: 'APIs & Routes' },
  { id: 'database',      icon: '🗄', label: 'Database' },
  { id: 'impact',        icon: '💥', label: 'Impact Analysis' },
  { id: 'assistant',     icon: '🤖', label: 'AI Assistant' },
];

const STATUS_LABELS = {
  pending: '⏳ Queued…',
  running: '⬇ Cloning…',
  done:    '✅ Done!',
  failed:  '❌ Failed',
};

export default function Sidebar() {
  const { repos, activeRepo, setActiveRepo, importRepo, refreshRepos, activePage, setActivePage } = useApp();
  const [importUrl, setImportUrl]   = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { status, message, error }

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url || importing) return;

    setImporting(true);
    setImportStatus({ status: 'pending', message: 'Starting import…' });

    try {
      await importRepo(url, (job) => {
        setImportStatus({
          status:  job.status,
          message: job.progress || STATUS_LABELS[job.status] || job.status,
          error:   job.error,
        });
      });

      // Success — clean up
      setImportUrl('');
      setImportStatus({ status: 'done', message: '✅ Repository imported!' });
      setTimeout(() => {
        setShowImport(false);
        setImportStatus(null);
      }, 1800);

    } catch (err) {
      setImportStatus({ status: 'failed', message: `❌ ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  const activeRepoObj = repos.find(r => r.name === activeRepo);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🧠</div>
        <div className="logo-text">
          <div className="logo-title">CodeMind AI</div>
          <div className="logo-sub">Codebase Intelligence</div>
        </div>
      </div>

      {/* Import Button */}
      <button
        className="sidebar-import"
        onClick={() => { setShowImport(s => !s); setImportStatus(null); }}
      >
        <span>＋</span> Import Repository
      </button>

      {/* Import Form */}
      {showImport && (
        <div style={{
          margin: '8px 12px',
          padding: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <input
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            disabled={importing}
            style={{
              width: '100%', padding: '7px 10px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              fontSize: '0.786rem', fontFamily: 'inherit', outline: 'none',
              marginBottom: 8, boxSizing: 'border-box',
              opacity: importing ? 0.6 : 1,
            }}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />

          {/* Status indicator */}
          {importStatus && (
            <div style={{
              fontSize: '0.75rem',
              marginBottom: 8,
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              background: importStatus.status === 'done'   ? 'rgba(16,185,129,0.1)'  :
                          importStatus.status === 'failed' ? 'rgba(239,68,68,0.1)'   :
                          'rgba(99,102,241,0.1)',
              color:      importStatus.status === 'done'   ? 'var(--green)'   :
                          importStatus.status === 'failed' ? 'var(--red)'     :
                          'var(--text-accent)',
              border: `1px solid ${
                importStatus.status === 'done'   ? 'rgba(16,185,129,0.2)' :
                importStatus.status === 'failed' ? 'rgba(239,68,68,0.2)'  :
                'rgba(99,102,241,0.2)'
              }`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {importing && importStatus.status !== 'done' && (
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      display: 'inline-block',
                      width: 4, height: 4,
                      background: 'var(--cyan)',
                      borderRadius: '50%',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
              )}
              {importStatus.message}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            style={{
              width: '100%', padding: '7px',
              background: importing ? 'rgba(99,102,241,0.4)' : 'var(--gradient-brand)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: '#fff', fontSize: '0.786rem', fontWeight: 600,
              cursor: importing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'opacity 0.2s',
              opacity: (!importUrl.trim()) ? 0.5 : 1,
            }}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="sidebar-section-label">Navigation</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Repositories */}
      <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Repositories</span>
        <button
          onClick={() => refreshRepos(false)}
          title="Refresh repo list"
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 13, padding: '0 14px',
          }}
        >⟳</button>
      </div>

      <div className="sidebar-repos">
        {repos.length === 0 ? (
          <div style={{ padding: '8px 10px', fontSize: '0.786rem', color: 'var(--text-muted)' }}>
            No repositories yet. Import one above!
          </div>
        ) : (
          repos.map(repo => (
            <div
              key={repo.name}
              className={`repo-item ${repo.name === activeRepo ? 'active' : ''}`}
              onClick={() => setActiveRepo(repo.name)}
            >
              <div className={`repo-dot ${repo.name === activeRepo ? 'online' : ''}`} />
              <span className="repo-name" title={repo.name}>{repo.name}</span>
              {repo.name === activeRepo && (
                <span className="repo-badge">Indexed</span>
              )}
            </div>
          ))
        )}

        {/* Repo status card */}
        {activeRepoObj && (
          <div className="repo-status-card">
            <div style={{ fontSize: '0.786rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Repository Status
            </div>
            <div className="repo-status-row">
              <span className="repo-status-label">Last indexed</span>
              <span className="repo-status-value">2 min ago</span>
            </div>
            <div className="repo-status-row">
              <span className="repo-status-label">Total files</span>
              <span className="repo-status-value">
                {activeRepoObj.file_count?.toLocaleString() ?? '—'}
              </span>
            </div>
            <div className="repo-status-row">
              <span className="repo-status-label">Size</span>
              <span className="repo-status-value">{activeRepoObj.size_mb ?? '—'} MB</span>
            </div>
            <button className="btn-reindex">⟳ Re-index Repository</button>
          </div>
        )}
      </div>

      {/* User */}
      <div className="sidebar-user">
        <div className="user-avatar">AD</div>
        <div className="user-info">
          <div className="user-name">Developer</div>
          <div className="user-plan">Free Plan</div>
        </div>
        <span className="user-chevron">⌄</span>
      </div>
    </aside>
  );
}
