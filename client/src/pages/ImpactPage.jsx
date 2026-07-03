import { useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

export default function ImpactPage() {
  const { activeRepo } = useApp();
  const [target, setTarget]       = useState('');
  const [mode, setMode]           = useState('file'); // 'file' | 'function'
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const analyze = async () => {
    if (!target.trim() || !activeRepo) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = mode === 'file'
        ? await api.fileImpact(activeRepo, target.trim())
        : await api.fnImpact(activeRepo, target.trim());
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const radius = result?.blast_radius || result?.impact_level || 'unknown';
  const RADIUS_COLOR = { low: 'var(--green)', medium: 'var(--orange)', high: 'var(--red)', critical: '#ff2d55' };
  const rColor = RADIUS_COLOR[radius?.toLowerCase()] || 'var(--text-muted)';

  const directDeps  = result?.direct_dependents  || [];
  const transitive  = result?.transitive_dependents || [];
  const workflows   = result?.affected_workflows || [];
  const layers      = result?.affected_layers    || [];

  return (
    <div className="content-area">
      {/* Input */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">💥 Impact Analysis</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['file', 'function'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  background: mode === m ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)',
                  color: mode === m ? 'var(--text-accent)' : 'var(--text-muted)',
                  fontFamily: 'inherit', fontSize: '0.857rem', fontWeight: mode === m ? 600 : 400,
                }}>
                  {m === 'file' ? '📄 File' : 'ƒ Function'}
                </button>
              ))}
            </div>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder={mode === 'file' ? 'e.g. fastapi/routing.py' : 'e.g. get_openapi'}
              onKeyDown={e => e.key === 'Enter' && analyze()}
              style={{
                flex: 1, minWidth: 200,
                padding: '7px 12px', background: 'var(--bg-input)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.857rem',
                outline: 'none',
              }}
            />
            <button onClick={analyze} disabled={loading || !target.trim()} style={{
              padding: '7px 20px', background: 'var(--gradient-brand)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: loading || !target.trim() ? 0.6 : 1,
            }}>
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: '0.857rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {result && (
        <>
          {/* Blast radius indicator */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 12, alignItems: 'stretch' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 140 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>BLAST RADIUS</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: rColor, textTransform: 'uppercase', lineHeight: 1 }}>
                {radius.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {directDeps.length + transitive.length} files affected
              </div>
            </div>
            {[
              { label: 'Direct Dependents',     value: directDeps.length, color: 'rgba(239,68,68,0.15)',   icon: '🔗' },
              { label: 'Transitive Dependents', value: transitive.length, color: 'rgba(245,158,11,0.15)', icon: '↪' },
              { label: 'Affected Workflows',    value: workflows.length,  color: 'rgba(99,102,241,0.15)', icon: '⚡' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.color }}>{s.icon}</div>
                <div className="stat-info">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Affected layers */}
          {layers.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.786rem', color: 'var(--text-muted)' }}>Affected layers:</span>
              {layers.map(l => <span key={l} className="badge badge-orange">{l}</span>)}
            </div>
          )}

          {/* Lists */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <DependentList title="Direct Dependents" items={directDeps} color="var(--red)" badge="BREAKS" />
            <DependentList title="Transitive Dependents" items={transitive} color="var(--orange)" badge="indirect" />
          </div>

          {workflows.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">⚡ Affected Workflows</div>
                <span className="badge badge-purple">{workflows.length}</span>
              </div>
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workflows.map((wf, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.857rem', color: 'var(--text-secondary)' }}>
                    {wf.name || wf}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DependentList({ title, items, color, badge }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span className="badge badge-gray">{items.length}</span>
      </div>
      <div style={{ padding: '0 0 8px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: '0.857rem' }}>None</div>
        ) : items.slice(0, 15).map((item, i) => (
          <div key={i} style={{
            padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 14 }}>📄</span>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.786rem', color: 'var(--text-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.file || item.path || item}
            </span>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: `${color}20`, color, fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}>
              {badge}
            </span>
          </div>
        ))}
        {items.length > 15 && (
          <div style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: '0.786rem' }}>
            +{items.length - 15} more…
          </div>
        )}
      </div>
    </div>
  );
}
