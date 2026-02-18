import { useState, useCallback, useRef, useEffect } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';
import { aiQuery, aiChat } from '../api/client';
import type { AIQueryResponse } from '../api/client';
import type { Trade } from '../types/trade';

type AIMode = 'data' | 'chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: Record<string, unknown>[];
  error?: string;
}

const API_BASE = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL
  ? (import.meta as unknown as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL
  : 'http://localhost:8000';

export function AIAssistant() {
  const [mode, setMode] = useState<AIMode>('data');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    setAIQueryResult,
    setAILoading,
    setAIChartOption,
    clearAIResult,
    getGridFilterContext,
    isAILoading,
  } = useBlotterStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    setInput('');
    addMessage({ role: 'user', content: text });

    setAILoading(true);
    // Only clear previous AI result when sending a new Data Query, so new result can replace.
    // General Chat must not clear — keeps existing query result and panel linkage.
    if (mode === 'data') {
      clearAIResult();
    }

    try {
      if (mode === 'data') {
        const context = getGridFilterContext();
        const res: AIQueryResponse = await aiQuery(text, context as Record<string, unknown>);

        if (res.error) {
          addMessage({
            role: 'assistant',
            content: `Query failed: ${res.error}`,
            error: res.error,
          });
        } else {
          const dataPreview = res.data?.length
            ? `Returned ${res.data.length} row(s).`
            : 'No rows returned.';
          let content = dataPreview;
          if (res.sql) content += `\n\n\`\`\`sql\n${res.sql}\n\`\`\``;

          addMessage({
            role: 'assistant',
            content,
            sql: res.sql,
            data: res.data,
          });

          setAIQueryResult({
            data: res.data ?? [],
            trades: res.trades,
            sql: res.sql,
            chartOption: res.chartOption ?? null,
            error: res.error ?? null,
          });
          if (res.chartOption) {
            setAIChartOption(res.chartOption);
          } else {
            setAIChartOption(null);
          }
        }
      } else {
        const history = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
        const { answer } = await aiChat(text, history);
        addMessage({ role: 'assistant', content: answer });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addMessage({
        role: 'assistant',
        content: `Error: ${message}. Ensure the backend is running at ${API_BASE} and OPENAI_API_KEY is set.`,
        error: message,
      });
    } finally {
      setAILoading(false);
    }
  }, [
    input,
    mode,
    messages,
    addMessage,
    setAILoading,
    clearAIResult,
    setAIQueryResult,
    setAIChartOption,
    getGridFilterContext,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    clearAIResult();
    setAIChartOption(null);
  }, [clearAIResult, setAIChartOption]);

  return (
    <div className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <span className="ai-assistant-title">AI Assistant</span>
        <div className="ai-assistant-mode-toggle">
          <button
            type="button"
            className={`ai-mode-btn ${mode === 'data' ? 'active' : ''}`}
            onClick={() => setMode('data')}
          >
            Data Query
          </button>
          <button
            type="button"
            className={`ai-mode-btn ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => setMode('chat')}
          >
            General Chat
          </button>
        </div>
        <button type="button" className="ai-clear-btn" onClick={handleClear} title="Clear chat and results">
          Clear
        </button>
      </div>

      <div className="ai-assistant-messages">
        {messages.length === 0 && (
          <div className="ai-assistant-placeholder">
            {mode === 'data'
              ? 'Ask a question in natural language to query the trade database (e.g. "Show BUY trades for last 7 days", "Total notional by product"). Results can update the grid and chart.'
              : 'Ask general fixed income questions. The AI uses the schema and context to answer.'}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-message ai-message-${msg.role}`}>
            <div className="ai-message-label">{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div className="ai-message-content">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
              {msg.sql && (
                <pre className="ai-sql-block">
                  <code>{msg.sql}</code>
                </pre>
              )}
              {msg.error && <div className="ai-message-error">{msg.error}</div>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-assistant-input-row">
        <textarea
          ref={inputRef}
          className="ai-assistant-input"
          placeholder={mode === 'data' ? 'Ask a data question...' : 'Ask anything about fixed income...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isAILoading}
        />
        <button
          type="button"
          className="ai-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isAILoading}
        >
          {isAILoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// Re-export for use in grid overlay type
export type { Trade };
