import { useApp } from '../AppContext';

export default function TopBar() {
  const { activeRepo, data, repos } = useApp();

  // Try to get size from repoInfo or repos list
  const repoObj  = repos.find(r => r.name === activeRepo);
  const sizeMb   = data?.info?.size_mb ?? repoObj?.size_mb;
  const isGit    = data?.info?.is_git_repo ?? true;

  // Derive a display subtitle
  const pattern  = data?.arch?.architecture_pattern;
  const subtitle = pattern && pattern !== 'Unknown'
    ? pattern
    : isGit ? 'Git Repository' : 'Local Repository';

  return (
    <header className="topbar">
      {/* Repo info */}
      <div className="topbar-repo">
        <span style={{ fontSize: 18 }}>📦</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            <span className="topbar-repo-name" title={activeRepo}>
              {activeRepo || 'No repository selected'}
            </span>
            {isGit && <span className="topbar-lock" title="Git repository">🔒</span>}
            {sizeMb && (
              <span style={{
                fontSize: '0.714rem', color: 'var(--text-muted)',
                background: 'var(--bg-input)', padding: '1px 7px',
                borderRadius: 10, border: '1px solid var(--border)',
                flexShrink: 0
              }}>
                {sizeMb} MB
              </span>
            )}
          </div>
          <div className="topbar-private">{subtitle}</div>
        </div>
      </div>

      {/* Search */}
      <div className="topbar-search">
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>🔍</span>
        <input placeholder="Search files, functions, classes…" />
        <span className="search-kbd">⌘ K</span>
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <div className="topbar-btn">
          🔔
          <div className="notif-badge" />
        </div>
        <div className="topbar-btn" title="Toggle theme">☀</div>
        <div className="topbar-avatar">AD</div>
      </div>
    </header>
  );
}
