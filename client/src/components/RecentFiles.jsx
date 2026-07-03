import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

const EXT_COLORS = {
  '.py':  '#3572A5', '.js':  '#f1e05a', '.ts':  '#2b7489',
  '.jsx': '#61dafb', '.tsx': '#2b7489', '.go':  '#00ADD8',
  '.rs':  '#dea584', '.rb':  '#701516', '.java':'#b07219',
  '.cs':  '#178600', '.cpp': '#f34b7d', '.html':'#e34c26',
  '.css': '#563d7c', '.sql': '#e38c00', '.md':  '#083fa1',
  '.sh':  '#89e051', '.yml': '#cb171e', '.json':'#f1e05a',
};

function extColor(filename) {
  const ext = filename?.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  return ext ? (EXT_COLORS[ext] || 'var(--text-muted)') : 'var(--text-muted)';
}

function extLabel(filename) {
  return filename?.match(/\.[^.]+$/)?.[0]?.slice(1).toUpperCase() || 'FILE';
}

export default function RecentFiles() {
  const { data, activeRepo, setActivePage } = useApp();
  const [files, setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeRepo) return;
    setLoading(true);

    // Fetch file nodes from the Knowledge Graph
    api.kgNodes(activeRepo, 'file', 20, 0)
      .then(res => {
        const nodes = res.nodes || [];
        // node.id format: "file::path/to/file.py"
        const parsed = nodes.map(n => {
          const path = n.id?.replace(/^file::/, '') || n.id || '';
          return {
            path,
            name: path.split('/').pop() || path,
            dir:  path.split('/').slice(0, -1).join('/') || '.',
            degree: n.degree ?? 0,
          };
        });
        // Sort by degree (most connected = most important)
        setFiles(parsed.sort((a, b) => b.degree - a.degree));
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [activeRepo]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">📁</span>
          Key Files
          <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
            {files.length} files
          </span>
        </div>
        <button
          className="card-action"
          onClick={() => setActivePage('knowledge')}
        >
          View All →
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="files-table" style={{ minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ width: 54 }}>Type</th>
              <th>File</th>
              <th>Directory</th>
              <th style={{ width: 80, textAlign: 'right' }}>Connections</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  Loading files…
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No files indexed yet. Run analysis first.
                </td>
              </tr>
            ) : files.map((file, i) => {
              const color = extColor(file.name);
              return (
                <tr key={i}>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px', borderRadius: 4,
                      background: `${color}20`, color,
                      fontSize: '0.65rem', fontWeight: 700,
                      fontFamily: 'monospace', letterSpacing: 0.3,
                    }}>
                      {extLabel(file.name)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.786rem',
                      color: 'var(--text-accent)',
                    }} title={file.path}>
                      {file.name}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.714rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', maxWidth: 240,
                      display: 'inline-block',
                    }} title={file.dir}>
                      {file.dir}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600,
                      color: file.degree > 10 ? 'var(--cyan)' : 'var(--text-secondary)',
                    }}>
                      {file.degree}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
