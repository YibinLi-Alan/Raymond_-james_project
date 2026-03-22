/**
 * Professional chart styling for AI-generated ECharts visualizations.
 * Enhances backend chart options with trading-terminal dark theme defaults.
 */

export const CHART_PALETTE = [
  '#2E75B6', '#5B9BD5', '#8FAADC', '#BDD7EE', '#4472C4',
  '#9DC3E6', '#7C8A96', '#A6A6A6', '#6B8CAE', '#BFBFBF',
];

const DEFAULT_GRID = {
  top: 40,
  right: 30,
  bottom: 50,
  left: 60,
  containLabel: true,
};

const DEFAULT_TOOLTIP = {
  backgroundColor: '#2d2d2d',
  borderColor: '#3d3d3d',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: {
    color: '#e0e0e0',
    fontSize: 12,
  },
};

const DEFAULT_AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#3d3d3d' } },
  axisTick: { show: false },
  axisLabel: { color: '#a0a0a0', fontSize: 11 },
};

const DEFAULT_TITLE = {
  left: 'center' as const,
  textStyle: { color: '#e0e0e0', fontSize: 14, fontWeight: 500 },
};

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (
      srcVal != null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal != null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      );
    } else if (srcVal !== undefined && (tgtVal === undefined || tgtVal === null)) {
      result[key] = srcVal;
    }
  }
  return result as T;
}

/** Apply professional dark-theme defaults to an ECharts option. */
export function enhanceChartOption(
  option: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!option || typeof option !== 'object') return null;

  const base = { ...option } as Record<string, unknown>;

  // Ensure transparent background
  if (!base.backgroundColor) base.backgroundColor = 'transparent';

  // Global text style
  base.textStyle = deepMerge(
    (base.textStyle as Record<string, unknown>) || {},
    { color: '#e0e0e0' }
  );

  // Grid (for cartesian charts - skip for pie/radar which don't use it)
  const hasCartesianAxes = base.xAxis || base.yAxis;
  if (hasCartesianAxes) {
    if (!base.grid) base.grid = DEFAULT_GRID;
    else if (typeof base.grid === 'object' && base.grid !== null) {
      base.grid = { ...DEFAULT_GRID, ...(base.grid as Record<string, unknown>) };
    }
  }

  // Tooltip
  if (!base.tooltip || (typeof base.tooltip === 'object' && Object.keys(base.tooltip as object).length === 0)) {
    base.tooltip = DEFAULT_TOOLTIP;
  } else if (typeof base.tooltip === 'object' && base.tooltip !== null) {
    base.tooltip = deepMerge(
      DEFAULT_TOOLTIP as Record<string, unknown>,
      base.tooltip as Record<string, unknown>
    );
  }

  // Title
  if (base.title && typeof base.title === 'object') {
    base.title = deepMerge(
      base.title as Record<string, unknown>,
      DEFAULT_TITLE as Record<string, unknown>
    );
  }

  // Axis styling
  for (const axis of ['xAxis', 'yAxis']) {
    const axisVal = base[axis];
    if (axisVal && typeof axisVal === 'object') {
      const arr = Array.isArray(axisVal) ? axisVal : [axisVal];
      const yAxisExtras = axis === 'yAxis' ? { splitLine: { lineStyle: { color: '#2d2d2d', type: 'dashed' } } } : {};
      base[axis] = arr.map((a: Record<string, unknown>) =>
        deepMerge({ ...DEFAULT_AXIS_STYLE, ...yAxisExtras } as Record<string, unknown>, a)
      );
    }
  }

  // Pie chart color palette and item style
  const series = base.series;
  if (Array.isArray(series)) {
    base.series = series.map((s: Record<string, unknown>, idx: number) => {
      const type = s.type as string;
      if (type === 'pie' || type === 'doughnut') {
        return {
          ...s,
          color: s.color ?? CHART_PALETTE,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#1e1e1e',
            borderWidth: 2,
            ...(s.itemStyle as Record<string, unknown> || {}),
          },
          label: {
            color: '#a0a0a0',
            fontSize: 10,
            ...(s.label as Record<string, unknown> || {}),
          },
          labelLine: {
            lineStyle: { color: '#3d3d3d' },
            ...(s.labelLine as Record<string, unknown> || {}),
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
            ...(s.emphasis as Record<string, unknown> || {}),
          },
        };
      }
      // Bar / line / scatter - ensure reasonable styling if missing
      if (type === 'bar' || type === 'line' || type === 'scatter') {
        const itemStyle = s.itemStyle as Record<string, unknown> | undefined;
        const lineStyle = s.lineStyle as Record<string, unknown> | undefined;
        const existingColor = itemStyle?.color ?? lineStyle?.color;
        const color = existingColor ?? CHART_PALETTE[idx % CHART_PALETTE.length];
        return {
          ...s,
          itemStyle: { ...(itemStyle || {}), color },
          ...(type === 'line' && {
            lineStyle: { width: 2, color, ...(lineStyle || {}) },
            symbol: lineStyle?.symbol ?? 'circle',
            symbolSize: lineStyle?.symbolSize ?? 6,
          }),
          ...(type === 'scatter' && { symbolSize: s.symbolSize ?? 8 }),
          emphasis: {
            ...(s.emphasis as Record<string, unknown> || {}),
            focus: type === 'line' ? 'series' : undefined,
            itemStyle: { borderColor: '#fff', borderWidth: 1, ...((s.emphasis as Record<string, unknown>)?.itemStyle as Record<string, unknown> || {}) },
            scale: type === 'scatter' ? 2 : undefined,
          },
        };
      }
      return s;
    });
  }

  return base;
}
