import { useApp } from '../AppContext';

// Only show programming/markup language extensions
const CODE_EXT_MAP = {
  '.py': 'Python',   '.pyw': 'Python',
  '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.go': 'Go',
  '.java': 'Java',   '.kt': 'Kotlin',
  '.rs': 'Rust',     '.rb': 'Ruby',
  '.php': 'PHP',     '.cs': 'C#',
  '.cpp': 'C++',     '.cc': 'C++',   '.c': 'C',
  '.html': 'HTML',   '.htm': 'HTML',
  '.css': 'CSS',     '.scss': 'CSS',  '.sass': 'CSS',
  '.sql': 'SQL',     '.graphql': 'GraphQL',
  '.sh': 'Shell',    '.bash': 'Shell',
  '.yaml': 'YAML',   '.yml': 'YAML',
  '.json': 'JSON',   '.toml': 'TOML',
  '.md': 'Markdown', '.mdx': 'Markdown',
  '.vue': 'Vue',     '.svelte': 'Svelte',
  '.dart': 'Dart',   '.swift': 'Swift',
};

const LANG_COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#8b8fa8'
];

// SVG Donut — pure SVG, no library
function DonutChart({ segments, size = 90 }) {
  const r = 34;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const slices = segments.map(s => {
    const dash = (s.pct / 100) * circ;
    const sl = { ...s, dash, offset };
    offset += dash;
    return sl;
  });

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="12"
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <div className="donut-center" style={{ fontSize: 18 }}>📊</div>
    </div>
  );
}

const FALLBACK_LANGS = [
  { name: 'Python',     pct: 62.4 },
  { name: 'JavaScript', pct: 18.1 },
  { name: 'TypeScript', pct: 11.3 },
  { name: 'HTML',       pct: 5.2  },
  { name: 'Other',      pct: 3.0  },
];

export default function TopLanguages() {
  const { data } = useApp();
  let langs = FALLBACK_LANGS;

  if (data?.info?.top_extensions) {
    const exts = data.info.top_extensions;

    // Group by language, filter to code only
    const grouped = {};
    let total = 0;

    for (const [ext, count] of Object.entries(exts)) {
      const lang = CODE_EXT_MAP[ext.toLowerCase()];
      if (lang) {
        grouped[lang] = (grouped[lang] || 0) + count;
        total += count;
      }
    }

    if (total > 0) {
      const sorted = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      langs = sorted.map(([name, count]) => ({
        name,
        pct: Math.round((count / total) * 1000) / 10
      }));
    }
  }

  const segments = langs.map((l, i) => ({
    ...l, color: LANG_COLORS[i] || '#555'
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">📊</span>
          Top Languages
        </div>
      </div>
      <div className="lang-chart">
        <DonutChart segments={segments} size={90} />
        <div className="lang-list">
          {langs.map((lang, i) => (
            <div className="lang-row" key={lang.name}>
              <div className="lang-dot" style={{ background: LANG_COLORS[i] }} />
              <span className="lang-name" title={lang.name}>{lang.name}</span>
              <div className="lang-bar-wrap">
                <div className="lang-bar" style={{ width: `${lang.pct}%`, background: LANG_COLORS[i] }} />
              </div>
              <span className="lang-pct">{lang.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
