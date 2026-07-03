import { useApp } from '../AppContext';

const STAT_DEFS = [
  { key: 'files',    label: 'Files',      icon: '📄', iconBg: 'rgba(99,102,241,0.15)' },
  { key: 'funcs',    label: 'Functions',  icon: 'ƒ',  iconBg: 'rgba(6,182,212,0.15)'  },
  { key: 'classes',  label: 'Classes',    icon: '⬡',  iconBg: 'rgba(245,158,11,0.15)' },
  { key: 'routes',   label: 'Routes',     icon: '🛤', iconBg: 'rgba(16,185,129,0.15)' },
  { key: 'size',     label: 'Size',       icon: '💾', iconBg: 'rgba(239,68,68,0.12)'  },
];

function deriveStats(data) {
  if (!data) return {};
  const { kg, info, routes } = data;
  return {
    files:   kg?.node_types?.file      ?? info?.file_count   ?? '—',
    funcs:   kg?.node_types?.function  ?? '—',
    classes: kg?.node_types?.class     ?? '—',
    routes:  routes?.total_routes      ?? '—',
    size:    info?.size_mb != null ? `${info.size_mb} MB` : '—',
  };
}

export default function StatsBar() {
  const { data, loading } = useApp();
  const stats = deriveStats(data);

  return (
    <div className="stats-bar">
      {STAT_DEFS.map(def => (
        <div className="stat-card" key={def.key}>
          <div className="stat-icon" style={{ background: def.iconBg }}>{def.icon}</div>
          <div className="stat-info">
            <div className="stat-label">{def.label}</div>
            <div className="stat-value">
              {loading
                ? <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>…</span>
                : typeof stats[def.key] === 'number'
                  ? stats[def.key].toLocaleString()
                  : (stats[def.key] ?? '—')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
