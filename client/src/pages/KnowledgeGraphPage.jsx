import { useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

const NODE_TYPE_COLORS = {
  file:     '#6366f1',
  class:    '#06b6d4',
  function: '#10b981',
  module:   '#f59e0b',
  external: '#8b8fa8',
};

export default function KnowledgeGraphPage() {
  const { data, activeRepo } = useApp();
  const kg = data?.kg;

  const [searchQ, setSearchQ]       = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching]   = useState(false);

  const doSearch = async () => {
    if (!searchQ.trim() || !activeRepo) return;
    setSearching(true);
    try {
      const res = await api.kgSearch(activeRepo, searchQ.trim(), '');
      setSearchResults(res.results || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const nodeTypes = kg?.node_types || {};
  const topNodes  = kg?.top_connected_nodes || [];

  return (
    <div className="content-area">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Nodes', value: kg?.total_nodes?.toLocaleString() || '—', icon: '⬡', color: 'rgba(99,102,241,0.15)'  },
          { label: 'Total Edges', value: kg?.total_edges?.toLocaleString() || '—', icon: '🔗', color: 'rgba(6,182,212,0.15)'   },
          { label: 'Files',       value: nodeTypes.file      || '—',               icon: '📄', color: 'rgba(99,102,241,0.15)'  },
          { label: 'Functions',   value: nodeTypes.function  || '—',               icon: 'ƒ',  color: 'rgba(16,185,129,0.15)'  },
          { label: 'Classes',     value: nodeTypes.class     || '—',               icon: '⚙', color: 'rgba(245,158,11,0.15)'  },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1rem' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Node type breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">⬡ Node Types</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(nodeTypes).map(([type, count]) => {
              const total = Object.values(nodeTypes).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_TYPE_COLORS[type] || '#555', flexShrink: 0 }} />
                  <span style={{ width: 80, fontSize: '0.786rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{type}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: NODE_TYPE_COLORS[type] || '#555', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: '0.786rem', color: 'var(--text-primary)', fontWeight: 600, width: 60, textAlign: 'right' }}>
                    {count?.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edge type breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔗 Edge Types</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(kg?.edge_types || {}).map(([type, count]) => {
              const total = Object.values(kg?.edge_types || {}).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 80, fontSize: '0.786rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{type}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cyan)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: '0.786rem', color: 'var(--text-primary)', fontWeight: 600, width: 60, textAlign: 'right' }}>
                    {count?.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔍 Search Knowledge Graph</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search nodes by name or type…"
              style={{
                flex: 1, padding: '7px 12px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                fontFamily: 'inherit', fontSize: '0.857rem', outline: 'none',
              }}
            />
            <button onClick={doSearch} disabled={searching} style={{
              padding: '7px 18px', background: 'var(--gradient-brand)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {searchResults && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.857rem' }}>No results found</div>
              ) : searchResults.map((node, i) => (
                <div key={i} style={{
                  padding: '8px 12px', background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: NODE_TYPE_COLORS[node.node_type] || '#555', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.786rem', color: 'var(--text-accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.id || node.name}</span>
                  <span className={`badge badge-${node.node_type === 'function' ? 'green' : node.node_type === 'class' ? 'cyan' : 'gray'}`}>{node.node_type}</span>
                  {node.degree && <span style={{ fontSize: '0.714rem', color: 'var(--text-muted)' }}>deg {node.degree}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top connected nodes */}
      {topNodes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">⭐ Most Connected Nodes</div>
            <span className="badge badge-gray">Top {topNodes.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="files-table">
              <thead>
                <tr><th>Node</th><th>Type</th><th>Connections</th></tr>
              </thead>
              <tbody>
                {topNodes.slice(0, 20).map((node, i) => (
                  <tr key={i}>
                    <td><span className="file-path">{node.id || node.name}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: NODE_TYPE_COLORS[node.node_type] || '#555' }} />
                        <span style={{ fontSize: '0.786rem', color: 'var(--text-secondary)' }}>{node.node_type}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{node.degree ?? node.connections ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
