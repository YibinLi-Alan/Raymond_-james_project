import { useState, useCallback, useRef, useEffect } from 'react';
import { useBlotterStore } from '../store/useBlotterStore';
import { aiQuery, aiChat } from '../api/client';
import type { AIQueryResponse } from '../api/client';
import type { Trade } from '../types/trade';

type AIMode = 'data' | 'chat';
type ChatResponseStyle = 'short' | 'detailed';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: Record<string, unknown>[];
  error?: string;
  explanationPrompt?: string;
  explanationStyle?: ChatResponseStyle;
  explanationResponseFor?: string;
}

const API_BASE = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL
  ? (import.meta as unknown as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL
  : 'http://localhost:8000';

const DATA_QUERY_SUGGESTIONS = [
  'What were the most traded securities today?',
  'Which traders executed the most trades today?',
  'What sectors had the most trading activity today?',
  'Which securities had unusual trading volume today?',
  'Did any traders change their trading behavior today?',
  'Which trades were outliers today?',
  'Which counterparty had the highest activity today?',
  'Show the largest trades today',
  'Compare today\'s trading volume to yesterday',
  'Show top traders by notional',
  'Which sectors were most active today?',
  'Which securities were traded the most today?',
  'Show unusual trading activity today',
  'What unusual patterns occurred today?',
  'Show total notional by product',
  'Show trade count by sector',
  'Compare today\'s volume to the historical average',
  'Show trader behavior changes today',
];

const GENERAL_CHAT_SUGGESTIONS = [
  'Explain today\'s trading activity',
  'Summarize the most active sectors today',
  'What unusual patterns occurred today?',
  'Explain the most traded securities today and show a graph',
  'Explain which traders were most active today',
  'Summarize the biggest trades today',
  'Explain unusual trading volume today',
  'Explain trader behavior changes today',
  'Summarize counterparty activity today',
  'Explain today versus yesterday trading volume',
  'Explain the top sectors and show a graph',
  'Explain the outlier trades today',
];

function shuffleItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickSuggestions(pool: string[], storageKey: string, count = 3): string[] {
  const shuffled = shuffleItems(pool);
  const previous = typeof window !== 'undefined'
    ? JSON.parse(window.sessionStorage.getItem(storageKey) ?? '[]') as string[]
    : [];

  let next = shuffled.filter((item) => !previous.includes(item)).slice(0, count);
  if (next.length < count) {
    const fallback = shuffled.filter((item) => !next.includes(item)).slice(0, count - next.length);
    next = [...next, ...fallback];
  }

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(storageKey, JSON.stringify(next));
  }
  return next;
}

export function AIAssistant() {
  const [mode, setMode] = useState<AIMode>('data');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [dataSuggestions, setDataSuggestions] = useState<string[]>([]);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([]);
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
    isAILoading,
    lastAiQueryResult,
  } = useBlotterStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setDataSuggestions(pickSuggestions(DATA_QUERY_SUGGESTIONS, 'ai-data-suggestions'));
    setChatSuggestions(pickSuggestions(GENERAL_CHAT_SUGGESTIONS, 'ai-chat-suggestions'));
  }, []);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
  }, []);

  const runChatExplanation = useCallback(async (text: string, style: ChatResponseStyle) => {
    setAILoading(true);
    try {
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
        contextSnapshot,
        style
      );
      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => !(m.role === 'assistant' && m.explanationResponseFor === text)
        );
        return filtered.map((m) =>
          m.role === 'assistant' && m.explanationPrompt === text
            ? { ...m, explanationStyle: style }
            : m
        ).concat({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          content: answer,
          explanationResponseFor: text,
        });
      });
      if (chatData) {
        const result = {
          data: chatData,
          trades: undefined,
          sql: undefined,
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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addMessage({
        role: 'assistant',
        content: `Error: ${message}. Ensure the backend is running at ${API_BASE} and backend/bedrock_credentials.env is configured with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and BEDROCK_MODEL_ID.`,
        error: message,
      });
    } finally {
      setAILoading(false);
    }
  }, [
    messages,
    lastAiQueryResult,
    addMessage,
    setAILoading,
    setAIQueryResult,
    setLastAiQueryResult,
    openPanel,
    setAIChartOption,
  ]);

  const handleSend = useCallback(async (prefilledText?: string) => {
    const text = (prefilledText ?? input).trim();
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
          const rowCount = res.data?.length ?? 0;
          const hasGraph = !!res.chartOption;
          let content = hasGraph
            ? `Total Trades: ${rowCount}\nGraph created from the current table.`
            : `Total Trades: ${rowCount}`;
          if (res.aiSummary && hasGraph) {
            content += `\n\n${res.aiSummary}`;
          }
          if (res.sql) content += `\n\nSQL used:\n\`\`\`sql\n${res.sql}\n\`\`\``;

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
          } else {
            setAIChartOption(null);
          }
        }
      } else {
        addMessage({
          role: 'assistant',
          content: 'Choose how you want this explained.',
          explanationPrompt: text,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addMessage({
        role: 'assistant',
        content: `Error: ${message}. Ensure the backend is running at ${API_BASE} and backend/bedrock_credentials.env is configured with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and BEDROCK_MODEL_ID.`,
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
    getGridFilterContext,
    visiblePanelIds,
    lastAiQueryResult,
    runChatExplanation,
  ]);

  const suggestionItems = mode === 'data' ? dataSuggestions : chatSuggestions;
  const graphTypeOptions = ['Bar Graph', 'Pie Chart', 'Line Chart', 'Doughnut Chart', 'Area Chart', 'Scatter Plot'];
  const hasVisualizationOptions = mode === 'data' && !!lastAiQueryResult?.data?.length;

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
            <div className="ai-suggested-queries">
              {suggestionItems.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="ai-suggestion-chip"
                  onClick={() => void handleSend(suggestion)}
                  disabled={isAILoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      {messages.map((msg) => (
          <div key={msg.id} className={`ai-message ai-message-${msg.role}`}>
            <div className="ai-message-label">{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div className="ai-message-content">
              {msg.content.split('\n').map((line, i) => {
                const trimmed = line.trim().replace(/\*\*/g, '');
                const isSectionTitle = /^(Short Explanation|Detailed Explanation|Feedback):?$/i.test(trimmed);
                return isSectionTitle ? (
                  <p key={i} className="ai-message-section-title">{trimmed.replace(/:$/, '')}</p>
                ) : (
                  <p key={i}>{trimmed || '\u00A0'}</p>
                );
              })}
              {msg.explanationPrompt && (
                <div className="ai-explanation-options">
                  <button
                    type="button"
                    className={`ai-explanation-btn ${msg.explanationStyle === 'short' ? 'active' : ''}`}
                    onClick={() => void runChatExplanation(msg.explanationPrompt as string, 'short')}
                    disabled={isAILoading}
                  >
                    Short Explanation
                  </button>
                  <button
                    type="button"
                    className={`ai-explanation-btn ${msg.explanationStyle === 'detailed' ? 'active' : ''}`}
                    onClick={() => void runChatExplanation(msg.explanationPrompt as string, 'detailed')}
                    disabled={isAILoading}
                  >
                    Detailed Explanation
                  </button>
                </div>
              )}
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

      {hasVisualizationOptions ? (
        <div className="ai-persistent-visualization-panel">
          <div className="ai-persistent-visualization-header">
            <span className="ai-persistent-visualization-title">Visualization Options</span>
            <span className="ai-persistent-visualization-subtitle">Switch graph types for the current table anytime</span>
          </div>
          <div className="ai-graph-type-options ai-graph-type-options-persistent">
            {graphTypeOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="ai-graph-type-btn"
                onClick={() => void handleSend(`Show this table as a ${option.toLowerCase()}`)}
                disabled={isAILoading}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'chat' && lastAiQueryResult?.data?.length ? (
        <div className="ai-context-indicator">
          Context: Analyzing last query results
        </div>
      ) : null}
      <div className="ai-assistant-input-row">
        <textarea
          ref={inputRef}
          className="ai-assistant-input"
          placeholder={mode === 'data' ? 'Ask about trading activity, traders, sectors, outliers, or behavior...' : 'Ask for a detailed explanation or insight summary...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isAILoading}
        />
        <button
          type="button"
          className="ai-send-btn"
          onClick={() => void handleSend()}
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
