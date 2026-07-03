import { useApp } from '../AppContext';

const METHOD_COLORS = {
  GET:    { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
  POST:   { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  PUT:    { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  PATCH:  { bg: 'rgba(6,182,212,0.15)',  color: '#06b6d4' },
  DELETE: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
};

function MethodBadge({ method }) {
  const s = METHOD_COLORS[method] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color,
      fontSize: '0.714rem', fontWeight: 700,
      fontFamily: 'monospace', flexShrink: 0, minWidth: 52, textAlign: 'center'
    }}>{method}</span>
  );
}

export default function RoutesPage() {
  const { data, activeRepo } = useApp();
  const routes = data?.routes;

  if (!routes) {
    return (
      <div className="content-area">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No route data available. Make sure the repository has been analyzed.
          </div>
        </div>
      </div>
    );
  }

  const allRoutes = routes.routes || [];
  const frameworks = routes.frameworks_detected || [];

  return (
    <div className="content-area">
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Routes',  value: routes.total_routes || allRoutes.length, icon: '🛤', color: 'rgba(99,102,241,0.15)'  },
          { label: 'API Routes',    value: routes.api_routes || '—',                 icon: '📡', color: 'rgba(6,182,212,0.15)'   },
          { label: 'Frameworks',    value: frameworks.join(', ') || '—',             icon: '🏗', color: 'rgba(245,158,11,0.15)'  },
          { label: 'Page Routes',   value: routes.page_routes || '—',                icon: '📄', color: 'rgba(16,185,129,0.15)'  },
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

      {/* Routes table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🛤 All API Routes</div>
          <span className="badge badge-purple">{allRoutes.length} routes</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="files-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Method</th>
                <th>Path</th>
                <th>Handler</th>
                <th>File</th>
                <th>Auth</th>
              </tr>
            </thead>
            <tbody>
              {allRoutes.slice(0, 100).map((route, i) => (
                <tr key={i}>
                  <td><MethodBadge method={route.method || 'GET'} /></td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.786rem', color: 'var(--cyan)' }}>
                      {route.path}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.786rem', color: 'var(--text-accent)' }}>
                      {route.handler || route.function || '—'}
                    </span>
                  </td>
                  <td className="file-path" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {route.file || '—'}
                  </td>
                  <td>
                    {route.requires_auth && <span className="badge badge-orange">Auth</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allRoutes.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No routes detected yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
