import { useApp } from '../AppContext';

// ── All known tech with display metadata ─────────────────────────
const TECH_META = {
  // Frontend frameworks (subset of "frameworks" key)
  'React':        { icon: '⚛',  color: '#61dafb' },
  'Next.js':      { icon: '▲',  color: '#aaaaaa' },
  'Vite':         { icon: '⚡', color: '#646cff' },
  'Vue':          { icon: '💚', color: '#42b883' },
  'Angular':      { icon: '🔴', color: '#dd0031' },
  'Svelte':       { icon: '🟠', color: '#ff3e00' },
  'Gatsby':       { icon: '💜', color: '#663399' },
  'Remix':        { icon: '🎵', color: '#121212' },
  'Astro':        { icon: '🚀', color: '#ff5d01' },
  // Backend frameworks
  'FastAPI':      { icon: '⚡', color: '#009688' },
  'Django':       { icon: '🎸', color: '#44b78b' },
  'Flask':        { icon: '🧪', color: '#ffffff' },
  'Starlette':    { icon: '⭐', color: '#009688' },
  'Express.js':   { icon: '🚂', color: '#68a063' },
  'NestJS':       { icon: '🐱', color: '#e0234e' },
  'Fastify':      { icon: '🚀', color: '#00bfb3' },
  'Koa':          { icon: '🌿', color: '#33333d' },
  'aiohttp':      { icon: '🌀', color: '#2c5364' },
  'Tornado':      { icon: '🌪', color: '#6b8e23' },
  'Hapi.js':      { icon: '🏗', color: '#f57c00' },
  'Sanic':        { icon: '⚡', color: '#00b4d8' },
  // Databases / ORMs
  'PostgreSQL':   { icon: '🐘', color: '#336791' },
  'MySQL':        { icon: '🐬', color: '#4479a1' },
  'MongoDB':      { icon: '🍃', color: '#47a248' },
  'SQLite':       { icon: '🗄', color: '#0f80cc' },
  'Redis':        { icon: '🔴', color: '#dc382d' },
  'Elasticsearch':{ icon: '🔍', color: '#f5bd1f' },
  'Cassandra':    { icon: '👁',  color: '#1287b1' },
  'DynamoDB':     { icon: '⚡', color: '#ff9900' },
  'Supabase':     { icon: '⚡', color: '#3ecf8e' },
  'Firebase':     { icon: '🔥', color: '#ffca28' },
  'SQLAlchemy':   { icon: '🗄', color: '#b1263e' },
  'Prisma':       { icon: '◆',  color: '#5a67d8' },
  'TypeORM':      { icon: '🔷', color: '#e83524' },
  'Mongoose':     { icon: '🍃', color: '#880000' },
  'SQLModel':     { icon: '🗄', color: '#009688' },
  'Knex.js':      { icon: '🔧', color: '#e16426' },
  // Task queues
  'Celery':       { icon: '🌿', color: '#37b24d' },
  'RQ':           { icon: '📋', color: '#dd5522' },
  'Bull':         { icon: '🐂', color: '#e01f1f' },
  'BullMQ':       { icon: '🐂', color: '#e01f1f' },
  'Dramatiq':     { icon: '🎭', color: '#7c3aed' },
  'APScheduler':  { icon: '⏰', color: '#f59e0b' },
  // AI
  'OpenAI':       { icon: '🤖', color: '#10a37f' },
  'LangChain':    { icon: '🔗', color: '#1c7ed6' },
  'PyTorch':      { icon: '🔥', color: '#ee4c2c' },
  'TensorFlow':   { icon: '🧠', color: '#ff6f00' },
  // Default
  '_':            { icon: '📦', color: '#6366f1' },
};

function meta(name) {
  return TECH_META[name] || TECH_META['_'];
}

// ── Classify each framework as frontend vs backend ────────────────
const FRONTEND_FRAMEWORKS = new Set([
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Gatsby',
  'Remix', 'Astro', 'Vite', 'Nuxt',
]);

function classifyFrameworks(frameworks = []) {
  const frontend = frameworks.filter(f => FRONTEND_FRAMEWORKS.has(f));
  const backend  = frameworks.filter(f => !FRONTEND_FRAMEWORKS.has(f));
  return { frontend, backend };
}

// ── Build node list from real tech_stack ─────────────────────────
// Keys from backend: languages, frameworks, databases, task_queue,
//                    auth, ai_stack, testing_tools, ui_libraries
function buildNodes(ts) {
  if (!ts) return null;

  const nodes = [];
  const { frontend, backend } = classifyFrameworks(ts.frameworks || []);

  // 1. Frontend
  if (frontend.length > 0) {
    const name = frontend[0];
    nodes.push({ label: 'Frontend', sublabel: name, ...meta(name) });
  }

  // 2. Backend framework
  if (backend.length > 0) {
    const name = backend[0];
    nodes.push({ label: 'Backend', sublabel: name, ...meta(name) });
  } else if (!frontend.length && ts.languages?.length > 0) {
    // Pure script — no framework detected, just show language
    const lang = ts.languages[0];
    nodes.push({ label: 'App', sublabel: lang, ...meta(lang) });
  }

  // 3. Database (first detected)
  if (ts.databases?.length > 0) {
    const name = ts.databases[0];
    nodes.push({ label: 'Database', sublabel: name, ...meta(name) });
  }

  return nodes.length > 0 ? nodes : null;
}

// ── Build secondary nodes (task queues, AI) ───────────────────────
function buildSecondary(ts) {
  if (!ts) return [];
  const items = [];

  // Task queues
  (ts.task_queue || []).slice(0, 1).forEach(name => {
    items.push({ label: 'Background Jobs', sublabel: name, ...meta(name) });
  });

  // AI stack (if any)
  (ts.ai_stack || []).slice(0, 1).forEach(name => {
    items.push({ label: 'AI / ML', sublabel: name, ...meta(name) });
  });

  return items;
}

// ── Sub-components ────────────────────────────────────────────────
function ArchNode({ label, sublabel, color, icon }) {
  return (
    <div className="arch-node">
      <div className="arch-node-icon" style={{
        background: `${color}18`,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 10px ${color}25`,
      }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className="arch-node-label">{label}</div>
      {sublabel && <div className="arch-node-sub">{sublabel}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      padding: '28px 16px', textAlign: 'center',
      color: 'var(--text-muted)', fontSize: '0.857rem',
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
    }}>
      <span style={{ fontSize: 32 }}>🏗</span>
      <div>No stack detected yet</div>
      <div style={{ fontSize: '0.786rem' }}>Run analysis to detect frameworks &amp; databases</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function SystemArchitecture() {
  const { data } = useApp();
  const arch = data?.arch;
  const ts   = arch?.tech_stack;

  const pattern     = arch?.architecture_pattern || null;
  const layers      = arch?.detected_layers      || [];
  const entryPoints = arch?.entry_points         || [];
  const summary     = arch?.summary              || '';

  // Fully dynamic — derived from real API data
  const mainNodes  = ts ? buildNodes(ts)      : null;
  const secondary  = ts ? buildSecondary(ts)  : [];

  // Additional tech chips (auth, ai_stack, extra dbs…)
  const extraDbs  = (ts?.databases  || []).slice(1);   // remaining DBs
  const authStack = ts?.auth        || [];
  const aiStack   = ts?.ai_stack    || [];

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">🏗</span>
          System Architecture
          {summary && (
            <span className="info-chip" title={summary}>ⓘ</span>
          )}
        </div>
        {pattern && (
          <span style={{
            padding: '3px 8px', background: 'var(--bg-input)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontSize: '0.714rem', color: 'var(--text-muted)',
            whiteSpace: 'nowrap', maxWidth: 140,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            📊 {pattern}
          </span>
        )}
      </div>

      {/* Main flow */}
      {!mainNodes ? (
        <EmptyState />
      ) : (
        <div className="arch-diagram">
          {mainNodes.map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <ArchNode {...node} />
              {i < mainNodes.length - 1 && (
                <div className="arch-arrow" style={{ marginTop: 12 }}>→</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Secondary (task queues, AI) */}
      {secondary.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, paddingBottom: 12 }}>
          {secondary.map((sec, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                width: 1, height: 16, borderLeft: '1px dashed rgba(255,255,255,0.1)',
                margin: '0 auto',
              }} />
              <ArchNode {...sec} />
            </div>
          ))}
        </div>
      )}

      {/* Extra DBs row */}
      {extraDbs.length > 0 && (
        <div style={{ padding: '0 14px 6px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {extraDbs.map(db => (
            <span key={db} className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
              {meta(db).icon} {db}
            </span>
          ))}
        </div>
      )}

      {/* Auth + AI chips */}
      {(authStack.length > 0 || aiStack.length > 0) && (
        <div style={{ padding: '0 14px 8px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {authStack.map(a => (
            <span key={a} className="badge badge-orange" style={{ fontSize: '0.7rem' }}>🔑 {a}</span>
          ))}
          {aiStack.map(a => (
            <span key={a} className="badge badge-purple" style={{ fontSize: '0.7rem' }}>🤖 {a}</span>
          ))}
        </div>
      )}

      {/* Detected layers */}
      {layers.length > 0 && (
        <div style={{ padding: '0 14px 12px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {layers.map(l => (
            <span key={l} className="badge badge-purple" style={{ fontSize: '0.7rem' }}>{l}</span>
          ))}
        </div>
      )}

      {/* Entry points */}
      {entryPoints.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.714rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            🚪 Entry:
          </span>
          {entryPoints.slice(0, 3).map((ep, i) => {
            const path = ep.path || ep.file || ep;
            const method = ep.method;
            return (
              <span key={i} style={{
                fontFamily: 'monospace', fontSize: '0.7rem',
                color: 'var(--text-accent)',
                background: 'rgba(99,102,241,0.08)',
                padding: '1px 6px', borderRadius: 3,
                maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={`${method || ''} ${path}`}>
                {method && <span style={{ color: 'var(--green)', marginRight: 3 }}>{method}</span>}
                {path}
              </span>
            );
          })}
          {entryPoints.length > 3 && (
            <span style={{ fontSize: '0.714rem', color: 'var(--text-muted)' }}>
              +{entryPoints.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
