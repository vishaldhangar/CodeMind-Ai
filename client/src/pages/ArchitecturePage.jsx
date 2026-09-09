import { useApp } from '../AppContext';
import SystemArchitecture from '../components/SystemArchitecture';

export default function ArchitecturePage() {
  const { data } = useApp();
  const arch = data?.arch;

  // ── Pre-process data outside JSX ─────────────────────────────
  const techCategories = [];
  if (arch?.tech_stack) {
    for (const [cat, val] of Object.entries(arch.tech_stack)) {
      const items = Array.isArray(val) ? val.filter(i => i != null && i !== '') : [];
      if (items.length > 0) techCategories.push({ cat, items });
    }
  }

  const totalTechItems = techCategories.reduce((s, { items }) => s + items.length, 0);
  const coreModules    = Array.isArray(arch?.core_modules) ? arch.core_modules : [];
  const summary        = arch?.summary || '';


  return (
    <div className="content-area">

      {/* ── Stat cards ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Pattern',      value: arch?.architecture_pattern || '—', icon: '🏗', color: 'rgba(99,102,241,0.15)'  },
          { label: 'Confidence',   value: arch?.pattern_confidence   || '—', icon: '📊', color: 'rgba(16,185,129,0.15)'  },
          { label: 'Layers',       value: arch?.detected_layers?.length || 0, icon: '📚', color: 'rgba(6,182,212,0.15)'  },
          { label: 'Entry Points', value: arch?.entry_points?.length  || 0,  icon: '🚪', color: 'rgba(245,158,11,0.15)' },
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

      {/* ── Diagram + Layers ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <SystemArchitecture />

        <div className="card">
          <div className="card-header">
            <div className="card-title">📚 Detected Layers</div>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(arch?.detected_layers || []).length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-muted)' }}>No layers detected</div>
            ) : (arch.detected_layers).map((layer, i) => (
              <div key={i} style={{
                padding: '8px 12px', background: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.857rem', color: 'var(--text-secondary)' }}>{layer}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tech Stack ───────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🛠 Tech Stack</div>
          {totalTechItems > 0 && (
            <span className="badge badge-gray">{totalTechItems} items</span>
          )}
        </div>

        {techCategories.length === 0 ? (
          <div style={{ padding: 16, color: '#888', fontSize: '0.875rem' }}>
            No tech stack detected. Re-index the repository to detect frameworks and libraries.
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {techCategories.map(({ cat, items }) => (
                <div key={cat}>
                  <div style={{ fontSize: '0.714rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {cat.replace(/_/g, ' ')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map(item => (
                      <span key={String(item)} className="badge badge-cyan">{String(item)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Core Modules ─────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔧 Core Modules</div>
          {coreModules.length > 0 && (
            <span className="badge badge-gray">{coreModules.length}</span>
          )}
        </div>

        {coreModules.length === 0 ? (
          <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: '0.857rem' }}>
            No core modules detected. Re-index the repository to build the call graph.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="files-table" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th>Module</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Call Count</th>
                  <th style={{ width: 120 }}>Layer</th>
                </tr>
              </thead>
              <tbody>
                {coreModules.slice(0, 20).map((m, i) => {
                  const raw   = String(m?.module || m?.file || '—');
                  const short = raw.replace(/^repositories[\\/][^\\/]+[\\/]/, '');
                  return (
                    <tr key={i}>
                      <td title={raw} style={{ color: '#6366f1', fontFamily: 'monospace', fontSize: '0.786rem', wordBreak: 'break-all' }}>
                        {short}
                      </td>
                      <td style={{ color: '#555', textAlign: 'right', paddingRight: 24 }}>
                        {m?.call_count ?? '—'}
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.714rem', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                          {m?.layer || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Architecture Summary ─────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📝 Architecture Summary</div>
        </div>
        <div style={{ padding: 16, lineHeight: 1.8, color: '#555', fontSize: '0.9rem' }}>
          {summary || 'No summary available. Re-index the repository to generate an architecture overview.'}
        </div>
      </div>

    </div>
  );
}
