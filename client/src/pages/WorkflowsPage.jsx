import { useApp } from '../AppContext';

const STEP_PALETTES = [
  ['#6366f1', '#818cf8', '#a5b4fc'],
  ['#06b6d4', '#22d3ee', '#67e8f9'],
  ['#f59e0b', '#fbbf24', '#fcd34d'],
  ['#10b981', '#34d399', '#6ee7b7'],
];

function StepDots({ steps, paletteIdx }) {
  const palette = STEP_PALETTES[paletteIdx % STEP_PALETTES.length];
  const count = Math.min(steps, 10);
  return (
    <div className="workflow-steps">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < count - 1 ? 1 : 'none' }}>
          <div className="step-dot" style={{ background: palette[i % palette.length], boxShadow: `0 0 5px ${palette[i % palette.length]}60` }} />
          {i < count - 1 && <div className="step-line" style={{ background: palette[i % palette.length] }} />}
        </div>
      ))}
    </div>
  );
}

export default function WorkflowsPage() {
  const { data } = useApp();
  const wfs   = data?.wf?.workflows || [];
  const total = data?.wf?.total_workflows || 0;

  return (
    <div className="content-area">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Workflows', value: total,                    icon: '⚡', color: 'rgba(99,102,241,0.15)' },
          { label: 'DB Workflows',    value: wfs.filter(w => w.touches_database).length, icon: '🗄', color: 'rgba(6,182,212,0.15)' },
          { label: 'Avg Depth',       value: wfs.length ? Math.round(wfs.reduce((a, w) => a + (w.depth || 0), 0) / wfs.length) : 0, icon: '📊', color: 'rgba(245,158,11,0.15)' },
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

      {/* Grid of workflow cards */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚡ All Workflows</div>
          <span className="badge badge-purple">{total} total</span>
        </div>
        {wfs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            No workflows found. Run analysis on the repository first.
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {wfs.map((wf, i) => (
              <div className="workflow-card" key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  {wf.entry?.method && (
                    <span style={{
                      padding: '1px 7px', borderRadius: 3,
                      background: 'rgba(99,102,241,0.15)', color: 'var(--text-accent)',
                      fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
                    }}>{wf.entry.method}</span>
                  )}
                  <div className="workflow-name" style={{ marginBottom: 0 }}>
                    {wf.entry?.path || wf.name || `Workflow ${i + 1}`}
                  </div>
                </div>
                <StepDots steps={wf.total_steps || wf.depth || 4} paletteIdx={i} />
                <div className="workflow-meta">
                  {wf.total_steps} steps · depth {wf.depth}
                  {wf.touches_database && ' · 🗄 DB'}
                  {wf.layers_involved?.length > 0 && (
                    <span style={{ color: 'var(--text-accent)', marginLeft: 4 }}>
                      · {wf.layers_involved.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
