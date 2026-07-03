// CodeMind AI — Backend API Client

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ── Repository ────────────────────────────────────────────────
export const api = {
  // Repos
  listRepos:    ()         => get('/repo/list'),
  importRepo:   (url)      => post('/repo/import', { github_url: url }),
  repoStatus:   (jobId)    => get(`/repo/import/status/${jobId}`),
  repoInfo:     (name)     => get(`/repo/${name}/info`),
  deleteRepo:   (name)     => fetch(`${BASE}/repo/${name}`, { method: 'DELETE' }).then(r => r.json()),

  // Analysis pipeline (must run in order before intelligence)
  scan:         (repo)     => get(`/scan/${repo}`),
  parseAst:     (repo)     => get(`/ast/${repo}`),
  buildDeps:    (repo)     => get(`/dependencies/${repo}`),

  // Intelligence
  architecture: (repo)     => get(`/architecture/${repo}`),
  callGraph:    (repo)     => get(`/callgraph/${repo}`),
  routes:       (repo)     => get(`/routes/${repo}`),
  database:     (repo)     => get(`/database/${repo}`),
  workflows:    (repo)     => get(`/workflow/${repo}`),
  dependencies: (repo)     => get(`/dependencies/${repo}`),
  ast:          (repo)     => get(`/ast/${repo}`),

  // Impact
  fileImpact:   (repo, path)   => get(`/impact/${repo}/file?path=${encodeURIComponent(path)}`),
  fnImpact:     (repo, fn)     => get(`/impact/${repo}/function/${fn}`),

  // Knowledge Graph
  kgSummary:   (repo)           => get(`/knowledge/${repo}/summary`),
  kgNodes:     (repo, type, limit=100, offset=0) =>
    get(`/knowledge/${repo}/nodes?type=${type||''}&limit=${limit}&offset=${offset}`),
  kgNode:      (repo, id)       => get(`/knowledge/${repo}/node/${encodeURIComponent(id)}`),
  kgEdges:     (repo, type, limit=200) =>
    get(`/knowledge/${repo}/edges?type=${type||''}&limit=${limit}`),
  kgSearch:    (repo, q, type)  => get(`/knowledge/${repo}/search?q=${q}${type?`&type=${type}`:''}`),
  inheritance: (repo, cls)      => get(`/knowledge/${repo}/inheritance/${cls}`),

  // AI Assistant
  health:       ()              => get('/assistant/health'),
  chat:         (repo, q, showThinking=false) =>
    post(`/assistant/${repo}/chat`, { question: q, show_thinking: showThinking }),
  explainFile:  (repo, path)    => get(`/assistant/${repo}/explain/file?path=${encodeURIComponent(path)}`),
  explainFn:    (repo, fn)      => get(`/assistant/${repo}/explain/function/${fn}`),

  // Streaming chat — returns EventSource-compatible URL info
  streamChat:   (repo, question, onToken, onDone, onError) => {
    fetch(`${BASE}/assistant/${repo}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token !== undefined) onToken(data.token);
              else if (data.done) onDone(data);
              else if (data.error) onError(data.error);
            } catch {}
          }
        }
      }
    }).catch(onError);
  },
};
