/**
 * API client for Morning Blotter backend (SQLite-backed + AI).
 * Uses VITE_API_BASE_URL when set (e.g. http://localhost:8000).
 */

import type { Trade } from '../types/trade';

const API_BASE = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL
  ? (import.meta as unknown as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL
  : 'http://localhost:8000';

export async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch(`${API_BASE}/api/trades`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Trades API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Trades API did not return an array');
  }
  return data as Trade[];
}

export async function healthCheck(): Promise<{ status: string; source?: string }> {
  const res = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// AI Assistant API
// ---------------------------------------------------------------------------

export interface AIQueryResponse {
  data: Record<string, unknown>[];
  trades?: Record<string, unknown>[];
  sql?: string;
  chartOption?: Record<string, unknown> | null;
  aiSummary?: string | null;
  anomalyTradeIds?: string[];
  error?: string | null;
}

export interface AIChatResponse {
  answer: string;
  chartOption?: Record<string, unknown> | null;
  data?: Record<string, unknown>[];
  sql?: string;
}

export async function aiQuery(
  question: string,
  context?: Record<string, unknown> & {
    previousQueryResult?: { data: Record<string, unknown>[]; sql?: string };
    conversationHistory?: { role: string; content: string }[];
  }
): Promise<AIQueryResponse> {
  const res = await fetch(`${API_BASE}/api/ai/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail ?? res.statusText;
    throw new Error(detail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Anomaly Detection API
// ---------------------------------------------------------------------------

export interface SizeAnomaly {
  tradeId: string;
  counterpartyName: string;
  zScore: number;
  direction: 'HIGH' | 'LOW';
  notionalUsd: number;
  cpMeanNotionalUsd: number;
  sampleSize: number;
}

export interface FrequencyAnomaly {
  counterpartyName: string;
  direction: 'HIGH' | 'LOW' | 'SILENT';
  zScore: number | null;
  todayCount: number;
  historicalDailyAvg: number;
  sampleDays: number;
  lowConfidence: boolean;
}

export interface AnomalyResponse {
  sizeAnomalies: SizeAnomaly[];
  frequencyAnomalies: FrequencyAnomaly[];
  dayPercentile: number;
  computedAt: string;
  counts: { size: number; frequency: number };
}

export async function fetchAnomalies(): Promise<AnomalyResponse> {
  const res = await fetch(`${API_BASE}/api/anomalies`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Anomalies API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<AnomalyResponse>;
}

export interface AIChatContextSnapshot {
  data: Record<string, unknown>[];
  sql?: string;
}

export async function aiChat(
  message: string,
  history?: { role: string; content: string }[],
  contextSnapshot?: AIChatContextSnapshot | null,
  responseStyle?: 'short' | 'detailed'
): Promise<AIChatResponse> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      message,
      history,
      context_snapshot: contextSnapshot ?? undefined,
      response_style: responseStyle ?? 'detailed',
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail ?? res.statusText;
    throw new Error(detail);
  }
  return res.json();
}
