import { useApp } from '../AppContext';
import SystemArchitecture from '../components/SystemArchitecture';

export default function ArchitecturePage() {
  const { data } = useApp();
  const arch = data?.arch;

  return (
    <div className="content-area">
      {/* Pattern stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Pattern',       value: arch?.architecture_pattern || '—',      icon: '🏗', color: 'rgba(99,102,241,0.15)'  },
          { label: 'Confidence',    value: arch?.pattern_confidence   || '—',      icon: '📊', color: 'rgba(16,185,129,0.15)'  },
          { label: 'Layers',        value: arch?.detected_layers?.length || 0,     icon: '📚', color: 'rgba(6,182,212,0.15)'   },
          { label: 'Entry Points',  value: arch?.entry_points?.length  || 0,       icon: '🚪', color: 'rgba(245,158,11,0.15)'  },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        {/* Architecture diagram */}
        <SystemArchitecture />

        {/* Layer breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📚 Detected Layers</div>
          </div>
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(arch?.detected_layers || []).length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-muted)' }}>No layers detected</div>
            ) : (arch?.detected_layers || []).map((layer, i) => (
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

      {/* Tech stack */}
      {arch?.tech_stack && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🛠 Tech Stack</div>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Object.entries(arch.tech_stack).map(([cat, items]) =>
              items?.length > 0 ? (
                <div key={cat}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'capitalize' }}>{cat}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map(item => <span key={item} className="badge badge-cyan">{item}</span>)}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Core modules */}
      {arch?.core_modules?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔧 Core Modules</div>
            <span className="badge badge-gray">{arch.core_modules.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="files-table" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Call Count</th>
                  <th>Layer</th>
                </tr>
              </thead>
              <tbody>
                {arch.core_modules.slice(0, 20).map((m, i) => (
                  <tr key={i}>
                    <td><span className="file-path">{m.module}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.call_count}</td>
                    <td><span className="badge badge-purple">{m.layer || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {arch?.summary && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📝 Architecture Summary</div>
          </div>
          <div className="card-body" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {arch.summary}
          </div>
        </div>
      )}
    </div>
  );
}
