import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [repos, setRepos]             = useState([]);
  const [activeRepo, setActiveRepo]   = useState(null);
  const [activePage, setActivePage]   = useState('overview');  // global nav
  const [repoData, setRepoData]       = useState({});
  const [loading, setLoading]         = useState({});
  const [analyzing, setAnalyzing]     = useState({});
  const [analyzeStatus, setAnalyzeStatus] = useState({});
  const activeRepoRef = useRef(activeRepo);

  useEffect(() => { activeRepoRef.current = activeRepo; }, [activeRepo]);

  // ── Fetch repo list ────────────────────────────────────────────
  const refreshRepos = useCallback(async (autoSelect = false) => {
    try {
      const data = await api.listRepos();
      const list = data.repositories || [];
      setRepos(list);
      if (autoSelect && list.length > 0 && !activeRepoRef.current) {
        setActiveRepo(list[0].name);
      }
    } catch {}
  }, []);

  useEffect(() => { refreshRepos(true); }, []);

  // ── Analysis pipeline: scan → AST → deps → intelligence ───────
  const analyzeRepo = useCallback(async (repoName) => {
    setAnalyzing(a => ({ ...a, [repoName]: true }));

    const step = (msg) =>
      setAnalyzeStatus(s => ({ ...s, [repoName]: msg }));

    try {
      step('Scanning files…');
      await api.scan(repoName).catch(() => {});

      step('Parsing AST…');
      await api.parseAst(repoName).catch(() => {});

      step('Building dependency graph…');
      await api.buildDeps(repoName).catch(() => {});

      step('Loading intelligence…');
    } finally {
      setAnalyzing(a => ({ ...a, [repoName]: false }));
      setAnalyzeStatus(s => ({ ...s, [repoName]: null }));
    }
  }, []);

  // ── Load intelligence data for a repo ─────────────────────────
  const loadRepoData = useCallback(async (repoName) => {
    if (!repoName || repoData[repoName]?.loaded) return;

    setLoading(l => ({ ...l, [repoName]: true }));

    try {
      // Run the analysis pipeline first
      await analyzeRepo(repoName);

      // Now load all intelligence in parallel
      const [arch, wf, routes, db, kg, info, deps] = await Promise.allSettled([
        api.architecture(repoName),
        api.workflows(repoName),
        api.routes(repoName),
        api.database(repoName),
        api.kgSummary(repoName),
        api.repoInfo(repoName),
        api.dependencies(repoName),
      ]);

      setRepoData(d => ({
        ...d,
        [repoName]: {
          loaded:  true,
          arch:    arch.status    === 'fulfilled' ? arch.value    : null,
          wf:      wf.status      === 'fulfilled' ? wf.value      : null,
          routes:  routes.status  === 'fulfilled' ? routes.value  : null,
          db:      db.status      === 'fulfilled' ? db.value      : null,
          kg:      kg.status      === 'fulfilled' ? kg.value      : null,
          info:    info.status    === 'fulfilled' ? info.value     : null,
          deps:    deps.status    === 'fulfilled' ? deps.value     : null,
        }
      }));
    } finally {
      setLoading(l => ({ ...l, [repoName]: false }));
    }
  }, [repoData, analyzeRepo]);

  useEffect(() => {
    if (activeRepo) loadRepoData(activeRepo);
  }, [activeRepo]);

  // ── Import a repo + poll until done ───────────────────────────
  const importRepo = useCallback(async (githubUrl, onStatus) => {
    const result = await api.importRepo(githubUrl);
    const jobId  = result.job_id;
    if (!jobId) throw new Error('No job_id returned from import');

    onStatus?.({ status: 'started', message: 'Cloning repository…' });

    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          const job = await api.repoStatus(jobId);
          onStatus?.(job);
          if (job.status === 'done') {
            clearInterval(poll);
            await refreshRepos(false);
            if (job.result?.repo_name) setActiveRepo(job.result.repo_name);
            resolve(job);
          } else if (job.status === 'failed') {
            clearInterval(poll);
            reject(new Error(job.error || 'Import failed'));
          }
        } catch (e) { clearInterval(poll); reject(e); }
      }, 2000);
    });
  }, [refreshRepos]);

  const data = activeRepo ? repoData[activeRepo] : null;

  return (
    <AppContext.Provider value={{
      repos,
      activeRepo, setActiveRepo,
      activePage, setActivePage,
      data,
      loading:       loading[activeRepo]       || false,
      analyzing:     analyzing[activeRepo]     || false,
      analyzeStatus: analyzeStatus[activeRepo] || null,
      importRepo,
      refreshRepos,
      refresh: () => {
        if (activeRepo) {
          setRepoData(d => { const n = { ...d }; delete n[activeRepo]; return n; });
        }
      }
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
