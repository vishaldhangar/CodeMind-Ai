import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../AppContext';

/* ── Constants ────────────────────────────────────────────────── */
const INT_COLOR  = '#818cf8';   // internal node / edge
const EXT_COLOR  = '#22d3ee';   // external node / edge
const SEL_COLOR  = '#f59e0b';   // selected highlight

/* ── Custom node ──────────────────────────────────────────────── */
function DepNode({ data, selected }) {
  const isInternal = data.isInternal;
  const color = isInternal ? INT_COLOR : EXT_COLOR;

  return (
    <div style={{
      padding: '6px 12px',
      borderRadius: 8,
      background: selected
        ? 'rgba(245,158,11,0.15)'
        : isInternal
        ? 'rgba(99,102,241,0.12)'
        : 'rgba(6,182,212,0.10)',
      border: `1.5px solid ${selected ? SEL_COLOR : color}`,
      boxShadow: selected
        ? `0 0 16px rgba(245,158,11,0.35)`
        : `0 0 8px ${isInternal ? 'rgba(99,102,241,0.2)' : 'rgba(6,182,212,0.18)'}`,
      minWidth: 80, maxWidth: 180,
      cursor: 'pointer',
      transition: 'all 0.15s',
      position: 'relative',
    }}>
      {/* type pill */}
      <div style={{
        position: 'absolute', top: -8, right: 6,
        fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.05em',
        padding: '1px 5px', borderRadius: 20,
        background: isInternal ? 'rgba(99,102,241,0.3)' : 'rgba(6,182,212,0.3)',
        color,
        textTransform: 'uppercase',
      }}>
        {isInternal ? 'internal' : 'ext'}
      </div>

      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.7rem',
        color: selected ? SEL_COLOR : color,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 160,
      }}>
        {data.label}
      </div>

      {data.connections > 0 && (
        <div style={{
          fontSize: '0.6rem',
          color: 'var(--text-muted)',
          marginTop: 2,
        }}>
          {data.connections} connection{data.connections !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = { dep: DepNode };

/* ── Layout: simple layered by connection count ───────────────── */
function computeLayout(nodes, edges) {
  const cols = Math.ceil(Math.sqrt(nodes.length * 1.5));
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: (i % cols) * 220 + 40,
      y: Math.floor(i / cols) * 100 + 40,
    },
  }));
}

/* ── Helpers ──────────────────────────────────────────────────── */
function shortLabel(path) {
  return path.split(/[/\\.]/).filter(Boolean).slice(-1)[0] || path;
}

/* ── Inner graph (needs ReactFlowProvider context) ────────────── */
function GraphCanvas({ rawDeps, filterType, onSelectNode }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build nodes & edges from rawDeps
  useEffect(() => {
    const filtered = filterType === 'all'
      ? rawDeps
      : rawDeps.filter(d => d.type === filterType);

    const nodeCounts = {};
    const internalSet = new Set();
    for (const d of filtered) {
      nodeCounts[d.source] = (nodeCounts[d.source] || 0) + 1;
      nodeCounts[d.target] = (nodeCounts[d.target] || 0) + 1;
      if (d.type === 'internal') { internalSet.add(d.source); internalSet.add(d.target); }
    }

    const nodeSet = new Set();
    for (const d of filtered) { nodeSet.add(d.source); nodeSet.add(d.target); }

    // Limit to top 80 by connections
    const sorted = [...nodeSet]
      .sort((a, b) => (nodeCounts[b] || 0) - (nodeCounts[a] || 0))
      .slice(0, 80);
    const sortedSet = new Set(sorted);

    const rawNodes = sorted.map(id => ({
      id,
      type: 'dep',
      data: {
        label: shortLabel(id),
        isInternal: internalSet.has(id),
        connections: nodeCounts[id] || 0,
      },
      position: { x: 0, y: 0 },
    }));

    const laid = computeLayout(rawNodes, []);

    const rfEdges = filtered
      .filter(d => sortedSet.has(d.source) && sortedSet.has(d.target) && d.source !== d.target)
      .slice(0, 400)
      .map((d, i) => ({
        id: `e-${i}`,
        source: d.source,
        target: d.target,
        animated: false,
        style: {
          stroke: d.type === 'internal' ? INT_COLOR : EXT_COLOR,
          strokeWidth: 1,
          strokeOpacity: 0.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: d.type === 'internal' ? INT_COLOR : EXT_COLOR,
          width: 10, height: 10,
        },
      }));

    setNodes(laid);
    setEdges(rfEdges);

    // Fit after layout
    setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDeps, filterType]);

  const onNodeClick = useCallback((_, node) => {
    onSelectNode(node);
  }, [onSelectNode]);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      minZoom={0.05}
      maxZoom={2.5}
      style={{ background: '#0b0d14' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1a1d2e" gap={24} size={1} />
      <Controls
        style={{
          background: '#131625', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
        }}
      />
      <MiniMap
        nodeColor={n => n.data?.isInternal ? INT_COLOR : EXT_COLOR}
        style={{
          background: '#0d0f1a',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8,
        }}
        maskColor="rgba(0,0,0,0.6)"
      />
    </ReactFlow>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function DependencyPage() {
  const { data } = useApp();
  const deps = data?.deps;

  const [tab, setTab]             = useState('graph');
  const [filterType, setFilterType] = useState('all');
  const [searchQ, setSearchQ]     = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  const rawDeps       = deps?.dependencies   || [];
  const totalNodes    = deps?.nodes          || 0;
  const totalEdges    = deps?.edges          || 0;
  const internalEdges = deps?.internal_edges || 0;
  const externalEdges = deps?.external_edges || 0;

  // Selected node neighbours
  const selectedInfo = useMemo(() => {
    if (!selectedNode) return null;
    const id = selectedNode.id;
    const outgoing = rawDeps.filter(d => d.source === id).slice(0, 20);
    const incoming = rawDeps.filter(d => d.target === id).slice(0, 20);
    return { id, outgoing, incoming, isInternal: selectedNode.data?.isInternal };
  }, [selectedNode, rawDeps]);

  // Top modules by import count
  const byTarget = useMemo(() => {
    const counts = {};
    for (const d of rawDeps) {
      if (!counts[d.target]) counts[d.target] = { internal: 0, external: 0, total: 0 };
      counts[d.target][d.type]++;
      counts[d.target].total++;
    }
    return Object.entries(counts)
      .map(([mod, c]) => ({ mod, ...c }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 25);
  }, [rawDeps]);

  // File rows (filtered)
  const fileRows = useMemo(() => {
    const list = searchQ.trim()
      ? rawDeps.filter(d => {
          const q = searchQ.toLowerCase();
          return d.source.toLowerCase().includes(q) || d.target.toLowerCase().includes(q);
        })
      : rawDeps;
    return list.slice(0, 120);
  }, [rawDeps, searchQ]);

  if (!deps) {
    return (
      <div className="content-area">
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: '80px 0',
        }}>
          <span style={{ fontSize: 52 }}>🔗</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            No dependency data
          </div>
          <div style={{ fontSize: '0.857rem', color: 'var(--text-muted)', maxWidth: 340, textAlign: 'center' }}>
            Select and analyse a repository to visualise its module dependency graph.
          </div>
        </div>
      </div>
    );
  }

  const intPct = totalEdges > 0 ? Math.round((internalEdges / totalEdges) * 100) : 0;

  return (
    <div className="content-area">
      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Modules',  value: totalNodes,    icon: '⬡', bg: 'rgba(99,102,241,0.15)',  accent: INT_COLOR },
          { label: 'Total Edges',    value: totalEdges,    icon: '🔗', bg: 'rgba(6,182,212,0.15)',   accent: EXT_COLOR },
          { label: 'Internal Deps',  value: internalEdges, icon: '🏠', bg: 'rgba(16,185,129,0.15)',  accent: '#10b981',
            sub: `${intPct}% of total` },
          { label: 'External Deps',  value: externalEdges, icon: '🌐', bg: 'rgba(245,158,11,0.15)',  accent: '#f59e0b',
            sub: `${100 - intPct}% of total` },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-icon" style={{ background: s.bg, fontSize: 18 }}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value?.toLocaleString() ?? '—'}</div>
              {s.sub && <div className="stat-delta" style={{ color: s.accent }}>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Card ── */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px',
        }}>
          <div className="tab-bar" style={{ border: 'none', flex: 1 }}>
            {[
              { key: 'graph',   icon: '⬡', label: 'Graph View' },
              { key: 'modules', icon: '📦', label: 'Top Modules' },
              { key: 'files',   icon: '📄', label: 'All Dependencies' },
            ].map(t => (
              <button
                key={t.key}
                className={`tab-btn ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span className="tab-icon">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════ GRAPH VIEW ══════ */}
        {tab === 'graph' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}>
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'all',      label: 'All',      accent: INT_COLOR, bg: 'rgba(99,102,241,0.15)' },
                  { key: 'internal', label: 'Internal', accent: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                  { key: 'external', label: 'External', accent: EXT_COLOR, bg: 'rgba(6,182,212,0.12)' },
                ].map(f => (
                  <button key={f.key} onClick={() => setFilterType(f.key)} style={{
                    padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem',
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    border: filterType === f.key ? `1px solid ${f.accent}` : '1px solid var(--border)',
                    background: filterType === f.key ? f.bg : 'var(--bg-input)',
                    color: filterType === f.key ? f.accent : 'var(--text-muted)',
                  }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {[
                  { color: INT_COLOR, label: 'Internal module' },
                  { color: EXT_COLOR, label: 'External package' },
                ].map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                    {l.label}
                  </span>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                <span>Click node to inspect</span>
              </div>
            </div>

            {/* Graph + side panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* React Flow canvas */}
              <div style={{ flex: 1, position: 'relative' }}>
                <ReactFlowProvider>
                  <GraphCanvas
                    rawDeps={rawDeps}
                    filterType={filterType}
                    onSelectNode={setSelectedNode}
                  />
                </ReactFlowProvider>
              </div>

              {/* Side detail panel */}
              {selectedInfo && (
                <div style={{
                  width: 250, borderLeft: '1px solid var(--border)',
                  background: 'var(--bg-sidebar)',
                  overflowY: 'auto', padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 14,
                  animation: 'slideInRight 0.18s ease',
                }}>
                  {/* Header */}
                  <div>
                    <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Selected Module
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                      color: selectedInfo.isInternal ? INT_COLOR : EXT_COLOR,
                      wordBreak: 'break-all', lineHeight: 1.5,
                    }}>
                      {selectedInfo.id}
                    </div>
                    <span className={`badge ${selectedInfo.isInternal ? 'badge-purple' : 'badge-cyan'}`} style={{ marginTop: 8, fontSize: '0.643rem' }}>
                      {selectedInfo.isInternal ? 'internal' : 'external'}
                    </span>
                  </div>

                  {/* Outgoing */}
                  {selectedInfo.outgoing.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        → Imports ({selectedInfo.outgoing.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selectedInfo.outgoing.map((e, i) => (
                          <div key={i} style={{
                            padding: '5px 8px', background: 'var(--bg-input)',
                            borderRadius: 5, fontSize: '0.714rem',
                            fontFamily: 'monospace',
                            color: e.type === 'internal' ? INT_COLOR : EXT_COLOR,
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {shortLabel(e.target)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming */}
                  {selectedInfo.incoming.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        ← Imported by ({selectedInfo.incoming.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selectedInfo.incoming.map((e, i) => (
                          <div key={i} style={{
                            padding: '5px 8px', background: 'var(--bg-input)',
                            borderRadius: 5, fontSize: '0.714rem',
                            fontFamily: 'monospace',
                            color: e.type === 'internal' ? INT_COLOR : EXT_COLOR,
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {shortLabel(e.source)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{
                      padding: '6px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'inherit', marginTop: 'auto',
                    }}
                  >
                    ✕ Deselect
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ TOP MODULES VIEW ══════ */}
        {tab === 'modules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
            {/* Left: table */}
            <div style={{ borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                fontSize: '0.857rem', fontWeight: 600, color: 'var(--text-primary)',
              }}>
                📦 Most Imported Modules
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table className="files-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>#</th>
                      <th>Module</th>
                      <th>Type</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTarget.map((row, i) => (
                      <tr key={row.mod}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>
                          <div style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                            color: row.internal > 0 ? INT_COLOR : EXT_COLOR, fontWeight: 600,
                          }}>
                            {shortLabel(row.mod)}
                          </div>
                          <div style={{ fontSize: '0.643rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                            {row.mod.length > 32 ? '…' + row.mod.slice(-30) : row.mod}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${row.internal > 0 ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: '0.625rem' }}>
                            {row.internal > 0 ? 'internal' : 'external'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              flex: 1, height: 4, background: 'rgba(255,255,255,0.05)',
                              borderRadius: 2, overflow: 'hidden', minWidth: 50,
                            }}>
                              <div style={{
                                width: `${Math.min(100, (row.total / byTarget[0].total) * 100)}%`,
                                height: '100%',
                                background: row.internal > 0 ? INT_COLOR : EXT_COLOR,
                                borderRadius: 2, transition: 'width 0.4s',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: 22, textAlign: 'right' }}>
                              {row.total}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: donut chart */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: '0.857rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                🥧 Dependency Distribution
              </div>

              {/* Donut */}
              {(() => {
                const total = internalEdges + externalEdges || 1;
                const r = 72, cx = 90, cy = 90, sw = 22;
                const circ = 2 * Math.PI * r;
                const intDash = (internalEdges / total) * circ;
                const extDash = circ - intDash;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                    <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
                      <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
                        {internalEdges > 0 && (
                          <circle cx={cx} cy={cy} r={r} fill="none" stroke={INT_COLOR}
                            strokeWidth={sw} strokeDasharray={`${intDash} ${extDash}`} strokeLinecap="butt" />
                        )}
                        {externalEdges > 0 && (
                          <circle cx={cx} cy={cy} r={r} fill="none" stroke={EXT_COLOR}
                            strokeWidth={sw} strokeDasharray={`${extDash} ${intDash}`}
                            strokeDashoffset={-intDash} strokeLinecap="butt" />
                        )}
                      </svg>
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {totalEdges.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)' }}>edges</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {[
                        { label: 'Internal', count: internalEdges, color: INT_COLOR, pct: intPct },
                        { label: 'External', count: externalEdges, color: EXT_COLOR, pct: 100 - intPct },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{ width: 11, height: 11, borderRadius: '50%', background: item.color }} />
                            <span style={{ fontSize: '0.857rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.786rem', color: 'var(--text-muted)' }}>{item.pct}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: '0.857rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Coupling card */}
                      <div style={{
                        marginTop: 4, padding: '12px 14px',
                        background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          Coupling Ratio
                        </div>
                        <div style={{
                          fontSize: '1.3rem', fontWeight: 700,
                          color: intPct > 50 ? 'var(--green)' : 'var(--orange)',
                        }}>
                          {totalEdges > 0 ? (internalEdges / totalEdges).toFixed(2) : '—'}
                        </div>
                        <div style={{ fontSize: '0.714rem', color: 'var(--text-muted)', marginTop: 3 }}>
                          {intPct > 50
                            ? '✓ Good cohesion — mostly internal'
                            : '⚠ Heavy external dependency'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══════ FILE DEPS VIEW ══════ */}
        {tab === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Filter by source or target module name…"
                style={{
                  width: '100%', padding: '7px 12px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  fontFamily: 'inherit', fontSize: '0.857rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border-active)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="files-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Source File</th>
                    <th>Target / Dependency</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {fileRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <span className="file-path" style={{ fontSize: '0.75rem' }}>
                          {row.source}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                          color: row.type === 'internal' ? INT_COLOR : EXT_COLOR,
                        }}>
                          {row.target}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${row.type === 'internal' ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: '0.625rem' }}>
                          {row.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {fileRows.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                        No matching dependencies
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {rawDeps.length > 120 && !searchQ && (
                <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: '0.714rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  Showing 120 of {rawDeps.length.toLocaleString()} dependencies — use search to narrow results
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
