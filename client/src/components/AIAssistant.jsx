import { useState, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';

const QUICK_ACTIONS = [
  'Show me the architecture diagram',
  'Which database is used?',
  'Generate API documentation',
];

const SUGGESTED = ['Find dead code', 'Show test cases', 'Code smells'];

function StreamingMessage({ content, isStreaming }) {
  return (
    <div className="msg-ai">
      <div className="msg-ai-header">
        <span style={{ fontSize: 14 }}>🧠</span>
        <span className="msg-ai-badge">CodeMind AI</span>
        {isStreaming && (
          <div className="streaming-badge">
            <div className="streaming-dots">
              <span /><span /><span />
            </div>
            qwen2.5:14b
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

export default function AIAssistant() {
  const { activeRepo } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'user',
      content: 'Explain how user login works in this codebase',
      time: '10:30 AM',
    },
    {
      role: 'ai',
      content: `The user login process works as follows:\n\n1. User sends credentials to \`POST /api/auth/login\`\n2. \`AuthController.py\` validates the request\n3. \`AuthService.verifyCredentials()\` checks user in database\n4. If valid, JWT token is generated using \`JWTService\`\n5. Token is returned to the client\n6. Client includes token in subsequent requests`,
      keyFiles: ['authController.py', 'authService.py', 'JWTService.py', 'userModel.py'],
      time: '10:30 AM',
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const sendMessage = (question) => {
    if (!question.trim() || !activeRepo || streaming) return;
    const q = question.trim();
    setInput('');

    setMessages(prev => [...prev, {
      role: 'user', content: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setMessages(prev => [...prev, { role: 'ai', content: '', streaming: true }]);
    setStreaming(true);

    let fullText = '';
    api.streamChat(
      activeRepo, q,
      (token) => {
        fullText += token;
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.role === 'ai') {
            next[lastIdx] = { ...next[lastIdx], content: fullText };
          }
          return next;
        });
      },
      () => {
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.role === 'ai') {
            next[lastIdx] = {
              ...next[lastIdx], streaming: false,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          }
          return next;
        });
        setStreaming(false);
      },
      (err) => {
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.role === 'ai') {
            next[lastIdx] = { ...next[lastIdx], content: `Error: ${err}`, streaming: false };
          }
          return next;
        });
        setStreaming(false);
      }
    );
  };

  /* ── Collapsed state: shows a slim vertical tab ── */
  if (collapsed) {
    return (
      <aside
        className="ai-panel ai-panel--collapsed"
        title="Expand AI Assistant"
      >
        {/* Vertical toggle strip */}
        <button
          className="ai-collapse-tab"
          onClick={() => setCollapsed(false)}
          title="Expand AI Assistant"
        >
          <span className="ai-collapse-icon">🧠</span>
          <span className="ai-collapse-label">AI Assistant</span>
          <span className="ai-collapse-arrow">‹</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="ai-panel ai-panel--expanded">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <div className="ai-icon">🧠</div>
          <div>
            <div className="ai-title-text">AI Assistant</div>
            <div className="ai-subtitle">Powered by qwen2.5:14b</div>
          </div>
        </div>
        {/* Collapse button */}
        <button
          className="ai-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Collapse AI Assistant"
        >
          ›
        </button>
      </div>

      {/* Messages */}
      <div className="ai-messages">
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
                  {msg.keyFiles.map(f => (
                    <span key={f} className="key-file-chip">📄 {f}</span>
                  ))}
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
          <button
            key={a}
            className="quick-action-btn"
            onClick={() => sendMessage(a)}
            disabled={streaming || !activeRepo}
          >
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
          <button
            className="ai-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!activeRepo || streaming}
          >
            ➤
          </button>
        </div>
        <div className="suggested-prompts">
          <div className="suggested-label">Suggested Prompts</div>
          <div className="suggested-chips">
            {SUGGESTED.map(s => (
              <span
                key={s}
                className="suggested-chip"
                onClick={() => sendMessage(s)}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
