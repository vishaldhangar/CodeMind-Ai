import { useApp } from '../AppContext';

const STEP_PALETTES = [
  ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
  ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'],
  ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
];

const METHOD_COLORS = {
  GET:    '#10b981', POST:  '#818cf8',
  PUT:    '#f59e0b', PATCH: '#06b6d4', DELETE: '#ef4444',
};

function WorkflowCard({ wf, paletteIdx }) {
  const palette    = STEP_PALETTES[paletteIdx % STEP_PALETTES.length];
  const totalSteps = wf.total_steps || wf.depth || 4;
  const steps      = Math.min(totalSteps, 8);
  const method     = wf.entry?.method;
  const path       = wf.entry?.path || wf.name || `Workflow ${paletteIdx + 1}`;

  return (
    <div className="workflow-card">
      {/* Header: method + path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, minWidth: 0 }}>
        {method && (
          <span style={{
            padding: '1px 6px', borderRadius: 3, flexShrink: 0,
            background: `${METHOD_COLORS[method] || '#6366f1'}20`,
            color: METHOD_COLORS[method] || '#818cf8',
            fontSize: '0.65rem', fontWeight: 700, fontFamily: 'monospace',
          }}>{method}</span>
        )}
        <div className="workflow-name" style={{ marginBottom: 0, flex: 1 }} title={path}>
          {path}
        </div>
      </div>

      {/* Step dots */}
      <div className="workflow-steps">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps - 1 ? 1 : 'unset' }}>
            <div className="step-dot" style={{
              background: palette[i % palette.length],
              boxShadow: `0 0 5px ${palette[i % palette.length]}70`,
            }} />
            {i < steps - 1 && <div className="step-line" style={{ background: palette[i % palette.length] }} />}
          </div>
        ))}
        {wf.touches_database && (
          <span style={{ fontSize: 11, marginLeft: 4 }} title="Touches database">🗄</span>
        )}
      </div>

      {/* Meta */}
      <div className="workflow-meta">
        {totalSteps} steps
        {wf.depth > 0 && ` · depth ${wf.depth}`}
        {wf.layers_involved?.length > 0 && (
          <span style={{ color: 'var(--text-accent)' }}>
            {' · '}{wf.layers_involved.slice(0, 2).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Workflows() {
  const { data, setActivePage } = useApp();
  const workflows = data?.wf?.workflows || [];
  const total     = data?.wf?.total_workflows ?? workflows.length;
  const shown     = workflows.slice(0, 6);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">⚡</span>
          Workflows
          <span className="badge badge-purple" style={{ fontSize: '0.714rem' }}>
            {total} total
          </span>
        </div>
        <button
          className="card-action"
          onClick={() => setActivePage('workflows')}
        >
          View All →
        </button>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.857rem' }}>
          No workflows detected yet.
        </div>
      ) : (
        <div className="workflow-grid">
          {shown.map((wf, i) => (
            <WorkflowCard key={i} wf={wf} paletteIdx={i} />
          ))}
        </div>
      )}
    </div>
  );
}
