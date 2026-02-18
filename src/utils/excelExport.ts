import * as XLSX from 'xlsx';
import { Trade } from '../types/trade';

interface ExportColumn {
  field: keyof Trade | string;
  headerName: string;
  valueFormatter?: (value: unknown) => string | number;
}

// Default columns for export
const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'internalTradeId', headerName: 'Trade ID' },
  { field: 'tradeDate', headerName: 'Trade Date' },
  { field: 'executionTimestamp', headerName: 'Execution Time' },
  { field: 'counterpartyName', headerName: 'Counterparty' },
  { field: 'side', headerName: 'Side' },
  { field: 'product', headerName: 'Product' },
  { field: 'tenor', headerName: 'Tenor' },
  {
    field: 'notionalUsd',
    headerName: 'Notional (USD)',
    valueFormatter: (v) => typeof v === 'number' ? v : 0,
  },
  {
    field: 'cleanPrice',
    headerName: 'Price',
    valueFormatter: (v) => typeof v === 'number' ? Number(v.toFixed(6)) : 0,
  },
  {
    field: 'yield',
    headerName: 'Yield (%)',
    valueFormatter: (v) => typeof v === 'number' ? Number(v.toFixed(4)) : '',
  },
  { field: 'deskId', headerName: 'Desk' },
  { field: 'traderId', headerName: 'Trader' },
  { field: 'settlementDate', headerName: 'Settlement Date' },
  { field: 'tradeCurrency', headerName: 'Trade Currency' },
  {
    field: 'accruedInterestAmount',
    headerName: 'Accrued Interest',
    valueFormatter: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : 0,
  },
  {
    field: 'grossTradeAmount',
    headerName: 'Gross Amount',
    valueFormatter: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : 0,
  },
  {
    field: 'netMoney',
    headerName: 'Net Money',
    valueFormatter: (v) => typeof v === 'number' ? Number(v.toFixed(2)) : 0,
  },
];

// Format date for filename
function formatDateForFilename(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Convert trades to export data
function tradesToExportData(
  trades: Trade[],
  columns: ExportColumn[] = DEFAULT_EXPORT_COLUMNS
): Record<string, unknown>[] {
  return trades.map(trade => {
    const row: Record<string, unknown> = {};
    columns.forEach(col => {
      const value = trade[col.field as keyof Trade];
      row[col.headerName] = col.valueFormatter
        ? col.valueFormatter(value)
        : value;
    });
    return row;
  });
}

// Export to Excel
export async function exportToExcel(
  trades: Trade[],
  filename?: string,
  columns?: ExportColumn[]
): Promise<void> {
  const exportData = tradesToExportData(trades, columns);

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  const colWidths = (columns || DEFAULT_EXPORT_COLUMNS).map(col => ({
    wch: Math.max(col.headerName.length + 2, 15),
  }));
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trades');

  // Generate filename
  const outputFilename = filename || `morning_blotter_${formatDateForFilename()}.xlsx`;

  // Save file
  XLSX.writeFile(workbook, outputFilename);
}

// Export grouped/aggregated data
export interface GroupedExportRow {
  group: string;
  notionalUsd: number;
  tradeCount: number;
  avgNotional?: number;
}

export async function exportGroupedToExcel(
  groupedData: GroupedExportRow[],
  groupByFields: string[],
  aggregationMode: 'SUM' | 'AVG',
  filename?: string
): Promise<void> {
  const exportData = groupedData.map(row => ({
    'Group': row.group,
    'Total Notional (USD)': aggregationMode === 'SUM' ? row.notionalUsd : row.avgNotional || 0,
    'Trade Count': row.tradeCount,
    'Grouped By': groupByFields.join(' > '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');

  const outputFilename = filename || `morning_blotter_summary_${formatDateForFilename()}.xlsx`;

  XLSX.writeFile(workbook, outputFilename);
}

// Copy to clipboard as TSV (for Excel paste)
export async function copyToClipboard(
  trades: Trade[],
  columns?: ExportColumn[]
): Promise<void> {
  const cols = columns || DEFAULT_EXPORT_COLUMNS;

  // Header row
  const header = cols.map(c => c.headerName).join('\t');

  // Data rows
  const rows = trades.map(trade => {
    return cols.map(col => {
      const value = trade[col.field as keyof Trade];
      const formatted = col.valueFormatter ? col.valueFormatter(value) : value;
      return formatted ?? '';
    }).join('\t');
  });

  const tsv = [header, ...rows].join('\n');

  await navigator.clipboard.writeText(tsv);
}
