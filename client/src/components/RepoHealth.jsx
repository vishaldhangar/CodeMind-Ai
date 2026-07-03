import { useApp } from '../AppContext';

function HealthRow({ icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '0.786rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: '0.786rem', fontWeight: 600,
        color: color || 'var(--text-primary)',
        background: color ? `${color}15` : 'transparent',
        padding: color ? '1px 8px' : 0,
        borderRadius: color ? 10 : 0,
      }}>{value}</span>
    </div>
  );
}

function CoverageBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {value?.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {max?.toLocaleString()}</span>
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function RepoHealth() {
  const { data, activeRepo } = useApp();
  const kg     = data?.kg;
  const arch   = data?.arch;
  const info   = data?.info;
  const routes = data?.routes;
  const ts     = arch?.tech_stack;

  const totalNodes   = kg?.total_nodes   ?? 0;
  const totalEdges   = kg?.total_edges   ?? 0;
  const fileCount    = info?.file_count  ?? 0;
  const kgFiles      = kg?.node_types?.file ?? 0;
  const kgFunctions  = kg?.node_types?.function ?? 0;
  const pattern      = arch?.architecture_pattern;
  const frameworks   = ts?.frameworks || [];
  const confidence   = arch?.pattern_confidence;

  // Derive health indicator
  const isHealthy = totalNodes > 0 && fileCount > 0;
  const healthColor = isHealthy ? 'var(--green)' : 'var(--orange)';
  const healthLabel = isHealthy ? 'Indexed' : 'Pending';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">💡</span>
          Repo Health
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 12,
          background: `${healthColor}15`,
          border: `1px solid ${healthColor}40`,
          fontSize: '0.714rem', fontWeight: 600, color: healthColor,
        }}>{healthLabel}</span>
      </div>

      <div style={{ padding: '4px 16px 0', flex: 1, overflow: 'hidden' }}>
        {/* Coverage bars */}
        {fileCount > 0 && (
          <div style={{ marginBottom: 12 }}>
            <CoverageBar label="Files indexed" value={kgFiles} max={fileCount} color="var(--purple)" />
            <CoverageBar label="Functions mapped" value={kgFunctions} max={Math.max(kgFunctions, 1)} color="var(--cyan)" />
          </div>
        )}

        {/* Quick stats */}
        <HealthRow icon="⬡" label="KG Nodes" value={totalNodes.toLocaleString()} />
        <HealthRow icon="🔗" label="KG Edges" value={totalEdges.toLocaleString()} />
        <HealthRow icon="🛤" label="API Routes"
          value={routes?.total_routes ?? '—'}
        />
        {pattern && pattern !== 'Unknown' && (
          <HealthRow icon="🏗" label="Pattern"
            value={pattern}
            color={confidence === 'high' ? 'var(--green)' : 'var(--text-accent)'}
          />
        )}
        {frameworks.length > 0 && (
          <HealthRow icon="🛠" label="Stack"
            value={frameworks.slice(0, 2).join(' + ')}
          />
        )}
        {info?.size_mb && (
          <HealthRow icon="💾" label="Repo Size" value={`${info.size_mb} MB`} />
        )}
      </div>
    </div>
  );
}
