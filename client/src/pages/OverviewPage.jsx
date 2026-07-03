import { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../AppContext';
import StatsBar          from '../components/StatsBar';
import SystemArchitecture from '../components/SystemArchitecture';
import TopLanguages      from '../components/TopLanguages';
import RepoHealth        from '../components/RepoHealth';
import Workflows         from '../components/Workflows';
import RecentActivity    from '../components/RecentActivity';
import RecentFiles       from '../components/RecentFiles';

const TABS = [
  { id: 'overview',     icon: '⊞', label: 'Overview'      },
  { id: 'architecture', icon: '🏗', label: 'Architecture'  },
  { id: 'workflows',    icon: '⚡', label: 'Workflows'     },
  { id: 'dependencies', icon: '🔗', label: 'Dependencies'  },
  { id: 'techstack',    icon: '🛠', label: 'Tech Stack'    },
  { id: 'summary',      icon: '📋', label: 'Summary'       },
];

/* ── Dependency graph helpers ────────────────────────────────── */
const INT_CLR = '#818cf8';
const EXT_CLR = '#22d3ee';

function shortLabel(p) {
  return p.split(/[/\\.]/).filter(Boolean).slice(-1)[0] || p;
}

function DepNode({ data, selected }) {
  const color = data.isInternal ? INT_CLR : EXT_CLR;
  return (
    <div style={{
      padding: '5px 10px', borderRadius: 7,
      background: selected
        ? 'rgba(245,158,11,0.15)'
        : data.isInternal ? 'rgba(99,102,241,0.12)' : 'rgba(6,182,212,0.10)',
      border: `1.5px solid ${selected ? '#f59e0b' : color}`,
      boxShadow: `0 0 8px ${data.isInternal ? 'rgba(99,102,241,0.18)' : 'rgba(6,182,212,0.15)'}`,
      minWidth: 70, maxWidth: 160, cursor: 'pointer',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
        color: selected ? '#f59e0b' : color, fontWeight: 600,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {data.label}
      </div>
      {data.connections > 0 && (
        <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {data.connections} conn
        </div>
      )}
    </div>
  );
}
const DEP_NODE_TYPES = { dep: DepNode };

function DepGraphInner({ rawDeps, filterType }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const filtered = filterType === 'all' ? rawDeps : rawDeps.filter(d => d.type === filterType);
    const counts = {};
    const intSet = new Set();
    for (const d of filtered) {
      counts[d.source] = (counts[d.source] || 0) + 1;
      counts[d.target] = (counts[d.target] || 0) + 1;
      if (d.type === 'internal') { intSet.add(d.source); intSet.add(d.target); }
    }
    const nodeSet = new Set(filtered.flatMap(d => [d.source, d.target]));
    const sorted = [...nodeSet].sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).slice(0, 60);
    const sortedSet = new Set(sorted);
    const cols = Math.ceil(Math.sqrt(sorted.length * 1.4));
    const rfNodes = sorted.map((id, i) => ({
      id, type: 'dep',
      data: { label: shortLabel(id), isInternal: intSet.has(id), connections: counts[id] || 0 },
      position: { x: (i % cols) * 200 + 30, y: Math.floor(i / cols) * 90 + 30 },
    }));
    const rfEdges = filtered
      .filter(d => sortedSet.has(d.source) && sortedSet.has(d.target) && d.source !== d.target)
      .slice(0, 300)
      .map((d, i) => ({
        id: `e${i}`, source: d.source, target: d.target, animated: false,
        style: { stroke: d.type === 'internal' ? INT_CLR : EXT_CLR, strokeWidth: 0.9, strokeOpacity: 0.45 },
        markerEnd: { type: MarkerType.ArrowClosed, color: d.type === 'internal' ? INT_CLR : EXT_CLR, width: 9, height: 9 },
      }));
    setNodes(rfNodes);
    setEdges(rfEdges);
    setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDeps, filterType]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={DEP_NODE_TYPES}
      fitView minZoom={0.05} maxZoom={2.5}
      style={{ background: '#0b0d14' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1a1d2e" gap={22} size={1} />
      <Controls style={{ background: '#131625', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }} />
      <MiniMap
        nodeColor={n => n.data?.isInternal ? INT_CLR : EXT_CLR}
        style={{ background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}
        maskColor="rgba(0,0,0,0.6)"
      />
    </ReactFlow>
  );
}

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data } = useApp();

  return (
    <div className="content-area">
      {/* ── Stats Bar ──────────────────────────────────── */}
      <StatsBar />

      {/* ── Sub-tabs ───────────────────────────────────── */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* Row 1: Architecture | Languages | Repo Health */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr',
            gap: 14,
            alignItems: 'stretch',
          }}>
            <SystemArchitecture />
            <TopLanguages />
            <RepoHealth />
          </div>

          {/* Row 2: Workflows | Recent Activity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr',
            gap: 14,
            alignItems: 'stretch',
          }}>
            <Workflows />
            <RecentActivity />
          </div>

          {/* Row 3: Key Files (full width) */}
          <RecentFiles />
        </>
      )}

      {/* ── Architecture tab ───────────────────────────── */}
      {activeTab === 'architecture' && <ArchitectureTab />}

      {/* ── Workflows tab ──────────────────────────────── */}
      {activeTab === 'workflows' && <WorkflowsTab />}

      {/* ── Dependencies tab ───────────────────────────── */}
      {activeTab === 'dependencies' && <DependenciesTab />}

      {/* ── Tech Stack tab ─────────────────────────────── */}
      {activeTab === 'techstack' && <TechStackTab />}

      {/* ── Summary tab ────────────────────────────────── */}
      {activeTab === 'summary' && <SummaryTab />}
    </div>
  );
}

/* ── Sub-tab components ──────────────────────────────────────────── */

function ArchitectureTab() {
  const { data } = useApp();
  const arch = data?.arch;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Pattern',    value: arch?.architecture_pattern || '—',     icon: '🏗' },
          { label: 'Confidence', value: arch?.pattern_confidence   || '—',     icon: '📊' },
          { label: 'Layers',     value: arch?.detected_layers?.length || 0,    icon: '📚' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)' }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1rem' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Layers */}
      {arch?.detected_layers?.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">📚 Detected Layers</div></div>
          <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {arch.detected_layers.map(l => (
              <span key={l} className="badge badge-purple">{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {arch?.summary && (
        <div className="card">
          <div className="card-header"><div className="card-title">📝 Summary</div></div>
          <div className="card-body" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {arch.summary}
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
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
            <table className="files-table" style={{ minWidth: 380 }}>
              <thead>
                <tr><th>Module</th><th>Call Count</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {arch.core_modules.map((m, i) => (
                  <tr key={i}>
                    <td><span className="file-path">{m.module}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.call_count}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowsTab() {
  const { data } = useApp();
  const wfs = data?.wf?.workflows || [];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">⚡ All Workflows ({data?.wf?.total_workflows || 0})</div>
      </div>
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {wfs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No workflows found.
          </div>
        ) : wfs.map((wf, i) => (
          <div key={i} style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(99,102,241,0.1)', color: 'var(--text-accent)',
              fontSize: '0.714rem', fontWeight: 600, fontFamily: 'monospace', flexShrink: 0,
            }}>{wf.entry?.method || 'GET'}</span>
            <span style={{ color: 'var(--cyan)', fontFamily: 'monospace', fontSize: '0.786rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {wf.entry?.path || wf.name}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.714rem', flexShrink: 0 }}>
              {wf.total_steps} steps
            </span>
            {wf.touches_database && <span title="DB">🗄</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DependenciesTab() {
  const { data } = useApp();
  const deps = data?.deps;
  const rawDeps = deps?.dependencies || [];
  const [filterType, setFilterType] = useState('all');

  const stats = useMemo(() => ({
    nodes:    deps?.nodes          || 0,
    edges:    deps?.edges          || 0,
    internal: deps?.internal_edges || 0,
    external: deps?.external_edges || 0,
  }), [deps]);

  if (!deps || rawDeps.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔗 Dependency Graph</div>
          <span className="badge badge-gray">0 modules</span>
        </div>
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: '0.929rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            No dependency data yet
          </div>
          <div style={{ fontSize: '0.8rem' }}>
            Analyse a repository to map its module dependencies.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Modules',  value: stats.nodes,    icon: '⬡', bg: 'rgba(99,102,241,0.15)' },
          { label: 'Edges',    value: stats.edges,    icon: '🔗', bg: 'rgba(6,182,212,0.15)'  },
          { label: 'Internal', value: stats.internal, icon: '🏠', bg: 'rgba(16,185,129,0.15)',
            sub: stats.edges > 0 ? `${Math.round((stats.internal / stats.edges) * 100)}%` : '' },
          { label: 'External', value: stats.external, icon: '🌐', bg: 'rgba(245,158,11,0.15)',
            sub: stats.edges > 0 ? `${Math.round((stats.external / stats.edges) * 100)}%` : '' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 16 }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1rem' }}>{s.value.toLocaleString()}</div>
              {s.sub && <div className="stat-delta">{s.sub} of total</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Graph card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all',      label: 'All',      clr: INT_CLR, bg: 'rgba(99,102,241,0.15)' },
              { key: 'internal', label: 'Internal', clr: '#10b981', bg: 'rgba(16,185,129,0.12)' },
              { key: 'external', label: 'External', clr: EXT_CLR, bg: 'rgba(6,182,212,0.12)' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterType(f.key)} style={{
                padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: filterType === f.key ? `1px solid ${f.clr}` : '1px solid var(--border)',
                background: filterType === f.key ? f.bg : 'var(--bg-input)',
                color: filterType === f.key ? f.clr : 'var(--text-muted)',
              }}>{f.label}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: INT_CLR, display: 'inline-block' }} /> Internal
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: EXT_CLR, display: 'inline-block' }} /> External
            </span>
          </div>
        </div>

        {/* React Flow canvas */}
        <div style={{ height: 420 }}>
          <ReactFlowProvider>
            <DepGraphInner rawDeps={rawDeps} filterType={filterType} />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}

function TechStackTab() {
  const { data } = useApp();
  const ts = data?.arch?.tech_stack || {};

  const CATEGORY_ICONS = {
    languages: '💻', frameworks: '🏗', databases: '🗄',
    ai_stack: '🤖', testing_tools: '🧪', auth: '🔑',
    task_queue: '⚡', http_clients: '🌐', ui_libraries: '🎨',
  };

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">🛠 Tech Stack</div></div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {Object.entries(ts).map(([cat, items]) =>
          items?.length > 0 ? (
            <div key={cat}>
              <div style={{ fontSize: '0.786rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center', textTransform: 'capitalize' }}>
                <span>{CATEGORY_ICONS[cat] || '📦'}</span> {cat.replace(/_/g, ' ')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(item => (
                  <span key={item} className="badge badge-cyan">{item}</span>
                ))}
              </div>
            </div>
          ) : null
        )}
        {Object.values(ts).every(v => !v?.length) && (
          <div style={{ color: 'var(--text-muted)', gridColumn: 'span 2', textAlign: 'center', padding: 40 }}>
            No tech stack data yet.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTab() {
  const { data } = useApp();
  const { arch, kg, routes, db } = data || {};

  const sections = [
    { title: '🏗 Architecture', items: [
      ['Pattern',      arch?.architecture_pattern || '—'],
      ['Confidence',   arch?.pattern_confidence   || '—'],
      ['Layers',       (arch?.detected_layers || []).join(', ') || '—'],
      ['Entry Points', arch?.entry_points?.length ?? '—'],
    ]},
    { title: '🕸 Knowledge Graph', items: [
      ['Total Nodes',  kg?.total_nodes?.toLocaleString() || '—'],
      ['Total Edges',  kg?.total_edges?.toLocaleString() || '—'],
      ['Files',        kg?.node_types?.file     ?? '—'],
      ['Functions',    kg?.node_types?.function ?? '—'],
      ['Classes',      kg?.node_types?.class    ?? '—'],
    ]},
    { title: '🛤 Routes', items: [
      ['Total Routes', routes?.total_routes  ?? '—'],
      ['API Routes',   routes?.api_routes    ?? '—'],
      ['Page Routes',  routes?.page_routes   ?? '—'],
      ['Frameworks',   (routes?.frameworks_detected || []).join(', ') || '—'],
    ]},
    { title: '🗄 Database', items: [
      ['Has DB',  db?.has_database ? 'Yes' : 'No'],
      ['Type',    db?.databases?.[0]?.type || '—'],
      ['ORM',     db?.databases?.[0]?.orm  || '—'],
      ['Models',  db?.db_models?.length    ?? '—'],
    ]},
  ];

  return (
    <>
      {arch?.summary && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">📝 Architecture Summary</div></div>
          <div className="card-body" style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {arch.summary}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {sections.map(sec => (
          <div key={sec.title} className="card">
            <div className="card-header"><div className="card-title">{sec.title}</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sec.items.map(([label, value]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '0.786rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '0.786rem', color: 'var(--text-secondary)', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
