import { useApp } from '../AppContext';

export default function LoadingState() {
  const { analyzeStatus, analyzing, loading } = useApp();
  const step = analyzeStatus;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20
    }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '2px solid rgba(99,102,241,0.2)',
          borderTop: '2px solid var(--purple)',
          animation: 'spin 1s linear infinite',
          position: 'absolute'
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24
        }}>🧠</div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {analyzing ? 'Analyzing Repository' : 'Loading Intelligence'}
        </div>
        <div style={{ fontSize: '0.857rem', color: 'var(--text-muted)' }}>
          {step || 'Please wait…'}
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: 260
      }}>
        {[
          { label: 'Scan files', done: step && !step.includes('Scanning') },
          { label: 'Parse AST',  done: step && !step.includes('Scanning') && !step.includes('Parsing') },
          { label: 'Build deps', done: step && step.includes('Loading') },
          { label: 'Load intelligence', done: !step && !analyzing },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: s.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${s.done ? 'var(--green)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10,
            }}>
              {s.done ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.786rem', color: s.done ? 'var(--green)' : 'var(--text-muted)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
