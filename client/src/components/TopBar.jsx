import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

/* ── tiny debounce ───────────────────────────────────────────── */
function useDebounce(value, ms) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return deb;
}

/* ── node type helpers ───────────────────────────────────────── */
const TYPE_COLOR = { file: '#6366f1', class: '#06b6d4', function: '#10b981', module: '#f59e0b' };
const TYPE_ICON  = { file: '📄', class: '⚙', function: 'ƒ', module: '📦' };

export default function TopBar() {
  const { activeRepo, data, repos, refresh, setActivePage, analyzing, analyzeStatus } = useApp();

  const repoObj  = repos.find(r => r.name === activeRepo);
  const sizeMb   = data?.info?.size_mb ?? repoObj?.size_mb;
  const pattern  = data?.arch?.architecture_pattern;
  const subtitle = pattern && pattern !== 'Unknown' ? pattern : 'Monolith / Script';

  /* ── Search ──────────────────────────────────────────────── */
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef   = useRef(null);
  const inputRef    = useRef(null);
  const debouncedQ  = useDebounce(query, 280);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Live search
  useEffect(() => {
    if (!debouncedQ.trim() || !activeRepo) { setResults([]); return; }
    setSearching(true);
    api.kgSearch(activeRepo, debouncedQ.trim(), '')
      .then(r => setResults(r.results?.slice(0, 8) || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQ, activeRepo]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!searchRef.current?.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleResultClick = useCallback((node) => {
    setSearchOpen(false);
    setQuery('');
    // Navigate to Knowledge Graph for now
    setActivePage('knowledge');
  }, [setActivePage]);

  /* ── Theme toggle ────────────────────────────────────────── */
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* ── Notifications ───────────────────────────────────────── */
  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, icon: '✅', text: 'Repository analysed successfully', time: '2 min ago', read: false },
    { id: 2, icon: '🔗', text: 'Dependency graph built — 3,309 edges', time: '2 min ago', read: false },
    { id: 3, icon: '🧠', text: 'Knowledge graph indexed', time: '3 min ago', read: true },
  ]);
  const notifRef = useRef(null);
  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, read: true })));

  useEffect(() => {
    const h = (e) => { if (!notifRef.current?.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Add notification when repo data loads
  useEffect(() => {
    if (data?.arch && activeRepo) {
      setNotifications(prev => {
        const already = prev.some(n => n.text.includes(activeRepo));
        if (already) return prev;
        return [
          { id: Date.now(), icon: '📦', text: `${activeRepo} loaded`, time: 'just now', read: false },
          ...prev,
        ].slice(0, 8);
      });
    }
  }, [data?.arch, activeRepo]);

  /* ── Avatar dropdown ─────────────────────────────────────── */
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (!avatarRef.current?.contains(e.target)) setAvatarOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <header className="topbar" style={{ position: 'relative', zIndex: 50 }}>
      {/* Repo info */}
      <div className="topbar-repo">
        <span style={{ fontSize: 18 }}>📦</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="topbar-repo-name" title={activeRepo}>
              {activeRepo || 'No repository selected'}
            </span>
            <span className="topbar-lock" title="Git repository">🔒</span>
            {sizeMb && (
              <span style={{
                fontSize: '0.714rem', color: 'var(--text-muted)',
                background: 'var(--bg-input)', padding: '1px 7px',
                borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0,
              }}>
                {sizeMb} MB
              </span>
            )}
          </div>
          <div className="topbar-private">{subtitle}</div>
        </div>
      </div>

      {/* ── Search ── */}
      <div ref={searchRef} style={{ flex: 1, maxWidth: 380, margin: '0 auto', position: 'relative' }}>
        <div
          className="topbar-search"
          style={{ borderColor: searchOpen ? 'var(--border-active)' : undefined }}
          onClick={() => { inputRef.current?.focus(); setSearchOpen(true); }}
        >
          <span style={{ color: searching ? 'var(--cyan)' : 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}>
            {searching ? '⟳' : '🔍'}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            placeholder="Search files, functions, classes…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.857rem', fontFamily: 'inherit' }}
          />
          {query ? (
            <button onClick={() => { setQuery(''); setResults([]); }} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0,
            }}>✕</button>
          ) : (
            <span className="search-kbd">⌘ K</span>
          )}
        </div>

        {/* Dropdown results */}
        {searchOpen && (query || results.length > 0) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden', zIndex: 100,
            animation: 'slideInRight 0.15s ease',
          }}>
            {!activeRepo ? (
              <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Select a repository to search
              </div>
            ) : !query ? (
              <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Type to search files, functions, classes…
              </div>
            ) : searching ? (
              <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="streaming-dots"><span/><span/><span/></span> Searching…
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No results for "{query}"
              </div>
            ) : (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: '0.643rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                {results.map((node, i) => (
                  <div
                    key={i}
                    onClick={() => handleResultClick(node)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', cursor: 'pointer',
                      borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: `${TYPE_COLOR[node.node_type] || '#555'}22`,
                      border: `1px solid ${TYPE_COLOR[node.node_type] || '#555'}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12,
                    }}>
                      {TYPE_ICON[node.node_type] || '⬡'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {node.id || node.name}
                      </div>
                      {node.file_path && (
                        <div style={{ fontSize: '0.643rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                          {node.file_path}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.625rem', padding: '2px 6px', borderRadius: 20,
                      background: `${TYPE_COLOR[node.node_type] || '#555'}22`,
                      color: TYPE_COLOR[node.node_type] || 'var(--text-muted)',
                      flexShrink: 0, textTransform: 'capitalize',
                    }}>
                      {node.node_type}
                    </span>
                    {node.degree && (
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        ×{node.degree}
                      </span>
                    )}
                  </div>
                ))}
                <div
                  onClick={() => { setActivePage('knowledge'); setSearchOpen(false); }}
                  style={{
                    padding: '8px 14px', fontSize: '0.75rem',
                    color: 'var(--text-accent)', cursor: 'pointer',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'center',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Open Knowledge Graph →
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="topbar-actions">

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <div
            className="topbar-btn"
            onClick={() => { setNotifOpen(o => !o); if (!notifOpen) {} }}
            title="Notifications"
            style={{ borderColor: notifOpen ? 'var(--border-active)' : undefined }}
          >
            🔔
            {unread > 0 && <div className="notif-badge" />}
          </div>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 300, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden', zIndex: 100,
              animation: 'slideInRight 0.15s ease',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.857rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Notifications {unread > 0 && <span style={{ background: 'var(--red)', color: '#fff', fontSize: '0.625rem', padding: '1px 5px', borderRadius: 10, marginLeft: 4 }}>{unread}</span>}
                </span>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{
                    background: 'none', border: 'none', fontSize: '0.714rem',
                    color: 'var(--text-accent)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
                  style={{
                    display: 'flex', gap: 10, padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: n.read ? 'transparent' : 'rgba(99,102,241,0.05)',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(99,102,241,0.05)'}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{n.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.786rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.text}</div>
                    <div style={{ fontSize: '0.643rem', color: 'var(--text-muted)', marginTop: 2 }}>{n.time}</div>
                  </div>
                  {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0, marginTop: 5 }} />}
                </div>
              ))}
              {notifications.length === 0 && (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No notifications
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div
          className="topbar-btn"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ fontSize: 16 }}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </div>

        {/* Avatar / profile */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <div
            className="topbar-avatar"
            onClick={() => setAvatarOpen(o => !o)}
            title="Profile"
            style={{ cursor: 'pointer', boxShadow: avatarOpen ? '0 0 0 2px var(--purple)' : 'none' }}
          >
            AD
          </div>

          {avatarOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 200, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden', zIndex: 100,
              animation: 'slideInRight 0.15s ease',
            }}>
              {/* User info */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.857rem', fontWeight: 600, color: 'var(--text-primary)' }}>Developer</div>
                <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginTop: 2 }}>Free Plan</div>
              </div>
              {/* Actions */}
              {[
                { icon: '🔄', label: 'Refresh data', action: () => { refresh(); setAvatarOpen(false); } },
                { icon: '⚙', label: 'Settings', action: () => setAvatarOpen(false) },
                { icon: '📖', label: 'Documentation', action: () => window.open('https://github.com', '_blank') },
                { icon: '🐛', label: 'Report issue', action: () => setAvatarOpen(false) },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.label === 'Refresh data' && analyzing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 14px',
                    background: 'none', border: 'none',
                    cursor: (item.label === 'Refresh data' && analyzing) ? 'not-allowed' : 'pointer',
                    color: (item.label === 'Refresh data' && analyzing) ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontFamily: 'inherit', textAlign: 'left',
                    opacity: (item.label === 'Refresh data' && analyzing) ? 0.6 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!(item.label === 'Refresh data' && analyzing)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>
                    {item.label === 'Refresh data' && analyzing ? '⟳' : item.icon}
                  </span>
                  {item.label === 'Refresh data' && analyzing
                    ? (analyzeStatus || 'Refreshing…')
                    : item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
