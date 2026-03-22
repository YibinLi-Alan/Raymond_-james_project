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
    setLastAiQueryResult,
    setAILoading,
    setAIChartOption,
    clearAIResult,
    getGridFilterContext,
    visiblePanelIds,
    openPanel,
    setActiveChartPanel,
    isAILoading,
    lastAiQueryResult,
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
    const t = text.trim().toLowerCase();
    const isGraphFollowUp =
      mode === 'data' &&
      !!lastAiQueryResult?.data?.length &&
      (t === 'yes' ||
        t === 'yeah' ||
        t === 'yep' ||
        t === 'please' ||
        t === 'sure' ||
        t === 'ok' ||
        t === 'okay' ||
        /\b(graph|chart|plot|visualize|visualization)\b/.test(t) ||
        /create.*graph|show.*graph|draw.*chart|graph it|plot it/i.test(t));
    if (mode === 'data' && !isGraphFollowUp) {
      clearAIResult();
    }

    try {
      if (mode === 'data') {
        const context = getGridFilterContext();
        const preferTradeBlotter = visiblePanelIds.includes('grid');
        const queryContext: Record<string, unknown> = {
          ...context,
          preferTradeBlotter,
        };
        if (lastAiQueryResult?.data?.length) {
          queryContext.previousQueryResult = {
            data: lastAiQueryResult.data,
            sql: lastAiQueryResult.sql,
          };
        }
        queryContext.conversationHistory = messages
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));
        const res: AIQueryResponse = await aiQuery(text, queryContext);

        if (res.error) {
          const isUserFacing =
            res.error.includes("I'm sorry") || res.error.includes("I cannot");
          addMessage({
            role: 'assistant',
            content: isUserFacing ? res.error : `Query failed: ${res.error}`,
            error: res.error,
          });
        } else {
          const dataPreview = res.data?.length
            ? `Returned ${res.data.length} row(s).`
            : 'No rows returned.';
          let content = res.aiSummary
            ? `${res.aiSummary}\n\n${dataPreview}`
            : dataPreview;
          if (res.sql) content += `\n\n\`\`\`sql\n${res.sql}\n\`\`\``;

          addMessage({
            role: 'assistant',
            content,
            sql: res.sql,
            data: res.data,
          });

          const result = {
            data: res.data ?? [],
            trades: res.trades,
            sql: res.sql,
            chartOption: res.chartOption ?? null,
            aiSummary: res.aiSummary ?? null,
            anomalyTradeIds: res.anomalyTradeIds ?? [],
            error: res.error ?? null,
          };
          setAIQueryResult(result);
          setLastAiQueryResult({ data: result.data, sql: result.sql });
          openPanel('aiDataTable');
          if (res.chartOption) {
            setAIChartOption(res.chartOption);
            openPanel('aiGraphPanel');
            setActiveChartPanel('aiGraphPanel');
          } else {
            setAIChartOption(null);
          }
        }
      } else {
        const history = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
        const contextSnapshot =
          lastAiQueryResult?.data?.length
            ? { data: lastAiQueryResult.data, sql: lastAiQueryResult.sql }
            : null;
        const { answer, chartOption, data: chatData, sql: chatSql } = await aiChat(
          text,
          history,
          contextSnapshot
        );
        addMessage({ role: 'assistant', content: answer });
        if (chatData) {
          const result = {
            data: chatData,
            trades: undefined,
            sql: chatSql ?? undefined,
            chartOption: chartOption ?? null,
            aiSummary: null,
            anomalyTradeIds: [],
            error: null,
          };
          setAIQueryResult(result);
          setLastAiQueryResult({ data: chatData, sql: chatSql });
          openPanel('aiDataTable');
        }
        if (chartOption) {
          setAIChartOption(chartOption);
          openPanel('aiGraphPanel');
          setActiveChartPanel('aiGraphPanel');
        }
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
    setLastAiQueryResult,
    setAIChartOption,
    openPanel,
    setActiveChartPanel,
    getGridFilterContext,
    visiblePanelIds,
    lastAiQueryResult,
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

      {mode === 'chat' && lastAiQueryResult?.data?.length ? (
        <div className="ai-context-indicator">
          Context: Analyzing last query results
        </div>
      ) : null}
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
