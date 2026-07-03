import { useApp } from '../AppContext';

export default function DatabasePage() {
  const { data } = useApp();
  const db = data?.db;

  if (!db || !db.has_database) {
    return (
      <div className="content-area">
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗄</div>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 6 }}>No Database Detected</div>
            <div style={{ fontSize: '0.857rem' }}>This repository doesn't appear to use a database layer.</div>
          </div>
        </div>
      </div>
    );
  }

  const databases = db.databases || [];
  const models    = db.db_models || [];
  const queries   = db.raw_queries || [];

  return (
    <div className="content-area">
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'DB Type',    value: databases[0]?.type || '—', icon: '🗄', color: 'rgba(99,102,241,0.15)' },
          { label: 'ORM',        value: databases[0]?.orm  || '—', icon: '⚙', color: 'rgba(6,182,212,0.15)'  },
          { label: 'Models',     value: models.length,              icon: '📋', color: 'rgba(245,158,11,0.15)' },
          { label: 'Raw Queries',value: queries.length,             icon: '🔍', color: 'rgba(16,185,129,0.15)' },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Models */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Database Models</div>
            <span className="badge badge-purple">{models.length}</span>
          </div>
          <div style={{ padding: '0 0 8px' }}>
            {models.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No models found</div>
            ) : models.map((m, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'flex-start', gap: 10
              }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.857rem', color: 'var(--cyan)', fontWeight: 600 }}>
                    {m.class_name || m.name}
                  </div>
                  {m.table_name && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Table: {m.table_name}
                    </div>
                  )}
                  {m.columns?.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {m.columns.slice(0, 4).map(c => (
                        <span key={c.name || c} style={{
                          display: 'inline-block', margin: '2px 3px',
                          padding: '1px 6px', background: 'var(--bg-input)',
                          borderRadius: 3, fontFamily: 'monospace'
                        }}>{c.name || c}</span>
                      ))}
                      {m.columns.length > 4 && (
                        <span style={{ color: 'var(--text-muted)' }}>+{m.columns.length - 4} more</span>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {m.file}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DB Info + Queries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚙ Database Configuration</div>
            </div>
            <div className="card-body">
              {databases.map((db, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(db).map(([k, v]) => v && (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '5px 0', borderBottom: '1px solid var(--border)'
                    }}>
                      <span style={{ fontSize: '0.786rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</span>
                      <span style={{ fontSize: '0.786rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {Array.isArray(v) ? v.join(', ') : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {queries.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">🔍 Raw Queries</div>
                <span className="badge badge-orange">{queries.length}</span>
              </div>
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {queries.slice(0, 8).map((q, i) => (
                  <div key={i} style={{
                    padding: '6px 10px', background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace', fontSize: '0.714rem',
                    color: 'var(--text-secondary)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }} title={q.query || q}>
                    {q.query || q}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
