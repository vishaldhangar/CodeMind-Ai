import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

const QUICK_ACTIONS = [
  'Show me the architecture diagram',
  'Which database is used?',
  'Generate API documentation',
];

const SUGGESTED = ['Find dead code', 'Show test cases', 'Code smells'];

// ── localStorage helpers ──────────────────────────────────────────────
function storageKey(repo) { return `codemind_chats_${repo}`; }

function loadSessions(repo) {
  if (!repo) return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(repo)) || '[]');
  } catch { return []; }
}

function saveSessions(repo, sessions) {
  if (!repo) return;
  // Strip streaming flags before persisting
  const clean = sessions.map(s => ({
    ...s,
    messages: s.messages.map(m => ({ ...m, streaming: false })),
  }));
  localStorage.setItem(storageKey(repo), JSON.stringify(clean));
}

function newSession() {
  return { id: Date.now().toString(), title: 'New Chat', createdAt: new Date().toISOString(), messages: [] };
}

function sessionTitle(session) {
  const first = session.messages.find(m => m.role === 'user');
  return first ? first.content.slice(0, 42) + (first.content.length > 42 ? '…' : '') : 'New Chat';
}

// ── Sub-components ────────────────────────────────────────────────────
function StreamingMessage({ content, isStreaming }) {
  return (
    <div className="msg-ai">
      <div className="msg-ai-header">
        <span style={{ fontSize: 14 }}>🧠</span>
        <span className="msg-ai-badge">CodeMind AI</span>
        {isStreaming && (
          <div className="streaming-badge">
            <div className="streaming-dots"><span /><span /><span /></div>
            Generating...
          </div>
        )}
      </div>
      <div
        style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
      {isStreaming && <span className="typing-cursor" />}
    </div>
  );
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/`([^`]+)`/g, '<code class="code-link">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s(.+)$/gm, '<strong style="color:var(--text-primary)">$1</strong>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<span style="color:var(--text-muted)">$1.</span> $2')
    .replace(/^- (.+)$/gm, '• $1');
}

function HistoryPanel({ sessions, activeId, onSelect, onDelete, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-card)', zIndex: 10,
      display: 'flex', flexDirection: 'column',
      borderRadius: 'inherit',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
          Chat History
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {sessions.length === 0 ? (
          <div style={{ padding: '24px 14px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            No previous chats for this repository.
          </div>
        ) : [...sessions].reverse().map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', cursor: 'pointer',
              background: s.id === activeId ? 'rgba(99,102,241,0.12)' : 'transparent',
              borderLeft: s.id === activeId ? '2px solid var(--purple)' : '2px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.8rem', color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {sessionTitle(s)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(s.createdAt).toLocaleDateString()} · {s.messages.filter(m => m.role === 'user').length} messages
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, flexShrink: 0,
                padding: '2px 4px', borderRadius: 4,
              }}
              title="Delete chat"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function AIAssistant() {
  const { activeRepo } = useApp();
  const [collapsed, setCollapsed]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions]       = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [input, setInput]             = useState('');
  const [streaming, setStreaming]     = useState(false);
  const messagesEndRef                = useRef(null);

  // ── Active session derived value ────────────────
  const activeSession = sessions.find(s => s.id === activeId) || null;
  const messages = activeSession?.messages || [];

  // ── Load sessions when repo changes ────────────
  useEffect(() => {
    if (!activeRepo) { setSessions([]); setActiveId(null); return; }
    const stored = loadSessions(activeRepo);
    if (stored.length > 0) {
      setSessions(stored);
      setActiveId(stored[stored.length - 1].id);
    } else {
      const fresh = newSession();
      setSessions([fresh]);
      setActiveId(fresh.id);
    }
    setInput('');
    setStreaming(false);
  }, [activeRepo]);

  // ── Persist whenever sessions change ────────────
  useEffect(() => {
    if (activeRepo && sessions.length > 0) {
      saveSessions(activeRepo, sessions);
    }
  }, [sessions, activeRepo]);

  // ── Scroll to bottom ────────────────────────────
  useEffect(() => {
    if (!collapsed) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, collapsed]);

  // ── Session helpers ─────────────────────────────
  const updateMessages = useCallback((updater) => {
    setSessions(prev => prev.map(s =>
      s.id === activeId ? { ...s, messages: updater(s.messages) } : s
    ));
  }, [activeId]);

  const startNewChat = () => {
    if (streaming) return;
    const fresh = newSession();
    setSessions(prev => [...prev, fresh]);
    setActiveId(fresh.id);
    setInput('');
  };

  const selectSession = (id) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const deleteSession = (id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        const fresh = newSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  // ── Send message ────────────────────────────────
  const sendMessage = (question) => {
    if (!question.trim() || !activeRepo || streaming) return;
    const q = question.trim();
    setInput('');

    updateMessages(prev => [...prev, {
      role: 'user', content: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    updateMessages(prev => [...prev, { role: 'ai', content: '', streaming: true }]);
    setStreaming(true);

    let fullText = '';
    api.streamChat(
      activeRepo, q,
      (token) => {
        fullText += token;
        setSessions(prev => prev.map(s => {
          if (s.id !== activeId) return s;
          const msgs = [...s.messages];
          const last = msgs.length - 1;
          if (msgs[last]?.role === 'ai') msgs[last] = { ...msgs[last], content: fullText };
          return { ...s, messages: msgs };
        }));
      },
      () => {
        setSessions(prev => prev.map(s => {
          if (s.id !== activeId) return s;
          const msgs = [...s.messages];
          const last = msgs.length - 1;
          if (msgs[last]?.role === 'ai') msgs[last] = {
            ...msgs[last], streaming: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          return { ...s, messages: msgs };
        }));
        setStreaming(false);
      },
      (err) => {
        setSessions(prev => prev.map(s => {
          if (s.id !== activeId) return s;
          const msgs = [...s.messages];
          const last = msgs.length - 1;
          if (msgs[last]?.role === 'ai') msgs[last] = { ...msgs[last], content: `Error: ${err}`, streaming: false };
          return { ...s, messages: msgs };
        }));
        setStreaming(false);
      }
    );
  };

  // ── Collapsed state ─────────────────────────────
  if (collapsed) {
    return (
      <aside className="ai-panel ai-panel--collapsed" title="Expand AI Assistant">
        <button className="ai-collapse-tab" onClick={() => setCollapsed(false)} title="Expand AI Assistant">
          <span className="ai-collapse-icon">🧠</span>
          <span className="ai-collapse-label">AI Assistant</span>
          <span className="ai-collapse-arrow">‹</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="ai-panel ai-panel--expanded" style={{ position: 'relative' }}>

      {/* History overlay */}
      {showHistory && (
        <HistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={selectSession}
          onDelete={deleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <div className="ai-icon">🧠</div>
          <div>
            <div className="ai-title-text">AI Assistant</div>
            <div className="ai-subtitle">Powered by OpenAI / Gemini</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {/* History button */}
          <button
            onClick={() => setShowHistory(v => !v)}
            title="Chat History"
            style={{
              padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600,
              background: showHistory ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            title="Previous chats"
          >
            🕐
          </button>
          {/* New Chat button */}
          <button
            onClick={startNewChat}
            disabled={streaming}
            title="New Chat"
            style={{
              padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 'var(--radius-sm)', color: 'var(--purple)',
              cursor: streaming ? 'not-allowed' : 'pointer', opacity: streaming ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            + New
          </button>
          {/* Collapse button */}
          <button className="ai-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse">›</button>
        </div>
      </div>

      {/* Active session label */}
      {activeSession && messages.length > 0 && (
        <div style={{
          padding: '4px 14px', fontSize: '0.7rem', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-input)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          💬 {sessionTitle(activeSession)}
        </div>
      )}

      {/* Messages */}
      <div className="ai-messages">
        {messages.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
            <div>Ask anything about <strong style={{ color: 'var(--text-primary)' }}>{activeRepo || 'your repository'}</strong></div>
          </div>
        )}
        {messages.map((msg, i) => (
          msg.role === 'user' ? (
            <div key={i}>
              <div className="msg-user">{msg.content}</div>
              {msg.time && <div className="msg-time">{msg.time}</div>}
            </div>
          ) : (
            <div key={i}>
              <StreamingMessage content={msg.content} isStreaming={!!msg.streaming} />
              {msg.keyFiles?.length > 0 && (
                <div className="key-files">
                  <div className="key-files-label">Key files involved:</div>
                  {msg.keyFiles.map(f => <span key={f} className="key-file-chip">📄 {f}</span>)}
                </div>
              )}
              {!msg.streaming && (
                <div className="msg-feedback">
                  <button className="feedback-btn">👍</button>
                  <button className="feedback-btn">👎</button>
                </div>
              )}
            </div>
          )
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="ai-quick-actions">
        {QUICK_ACTIONS.map(a => (
          <button key={a} className="quick-action-btn" onClick={() => sendMessage(a)} disabled={streaming || !activeRepo}>
            {a}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="ai-input-area">
        <div className="ai-input-row">
          <input
            className="ai-input"
            placeholder={activeRepo ? 'Ask anything about this repository…' : 'Select a repository first…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            disabled={!activeRepo || streaming}
          />
          <button className="ai-send-btn" onClick={() => sendMessage(input)} disabled={!activeRepo || streaming}>➤</button>
        </div>
        <div className="suggested-prompts">
          <div className="suggested-label">Suggested Prompts</div>
          <div className="suggested-chips">
            {SUGGESTED.map(s => (
              <span key={s} className="suggested-chip" onClick={() => sendMessage(s)}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
