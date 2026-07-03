import { useApp } from '../AppContext';

const EVENT_ICONS = {
  success: { icon: '✅', color: 'var(--green)' },
  info:    { icon: '🔵', color: 'var(--cyan)'  },
  purple:  { icon: '🟣', color: 'var(--purple)' },
  yellow:  { icon: '🟡', color: 'var(--orange)' },
  gray:    { icon: '⚪', color: 'var(--text-muted)' },
};

// Derive real analysis events from API data
function deriveEvents(data, activeRepo) {
  if (!data) return [];
  const { kg, arch, routes, db, info } = data;
  const events = [];

  if (info?.file_count) {
    events.push({
      type: 'success',
      text: `Repository indexed`,
      detail: `${info.file_count.toLocaleString()} files · ${info.size_mb} MB`,
    });
  }

  if (kg?.node_types?.file) {
    events.push({
      type: 'info',
      text: `${kg.node_types.file.toLocaleString()} files parsed`,
      detail: `${(kg.node_types.function ?? 0).toLocaleString()} functions extracted`,
    });
  }

  if (kg?.total_nodes) {
    events.push({
      type: 'purple',
      text: `Knowledge Graph built`,
      detail: `${kg.total_nodes.toLocaleString()} nodes · ${kg.total_edges?.toLocaleString()} edges`,
    });
  }

  if (arch?.architecture_pattern && arch.architecture_pattern !== 'Unknown') {
    events.push({
      type: 'info',
      text: `Architecture detected`,
      detail: `${arch.architecture_pattern} · ${arch.pattern_confidence || 'low'} confidence`,
    });
  }

  if (routes?.total_routes) {
    events.push({
      type: 'yellow',
      text: `${routes.total_routes} API routes mapped`,
      detail: (routes.frameworks_detected || []).join(', ') || 'detected from source',
    });
  }

  if (db?.has_database) {
    const dbType = db.databases?.[0]?.type || 'Database';
    events.push({
      type: 'yellow',
      text: `${dbType} database detected`,
      detail: `${db.db_models?.length ?? 0} models identified`,
    });
  }

  if (arch?.tech_stack?.ai_stack?.length) {
    events.push({
      type: 'purple',
      text: `AI stack detected`,
      detail: arch.tech_stack.ai_stack.slice(0, 2).join(', '),
    });
  }

  if (arch?.core_modules?.length) {
    events.push({
      type: 'gray',
      text: `${arch.core_modules.length} core modules identified`,
      detail: arch.core_modules[0]?.module?.split('/').pop() || '',
    });
  }

  return events;
}

export default function RecentActivity() {
  const { data, activeRepo } = useApp();
  const events = deriveEvents(data, activeRepo);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">⏱</span>
          Analysis Events
        </div>
        {events.length > 0 && (
          <span className="badge badge-green">{events.length} events</span>
        )}
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '4px 0 8px',
        maxHeight: 280,
      }}>
        {events.length === 0 ? (
          <div style={{
            padding: '28px 16px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: '0.857rem',
          }}>
            No analysis data yet.<br />
            <span style={{ fontSize: '0.786rem' }}>Select and analyze a repository to see events.</span>
          </div>
        ) : events.map((ev, i) => {
          const { icon, color } = EVENT_ICONS[ev.type] || EVENT_ICONS.gray;
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '8px 16px',
              borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 12, marginTop: 2, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.786rem', fontWeight: 500,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{ev.text}</div>
                {ev.detail && (
                  <div style={{
                    fontSize: '0.714rem', color: 'var(--text-muted)', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{ev.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
