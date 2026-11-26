export const AVIATOR_COMPACT_LAYOUT_BREAKPOINT_DP = 1000;
export const AVIATOR_COMPACT_CONTROLS_RESERVED_HEIGHT_DP = 520;
export const AVIATOR_COMPACT_CHART_MIN_HEIGHT_DP = 120;
export const AVIATOR_COMPACT_CHART_MAX_HEIGHT_DP = 320;

export function getAviatorCompactChartHeight(usableHeight: number): number {
  return Math.max(
    AVIATOR_COMPACT_CHART_MIN_HEIGHT_DP,
    Math.min(
      AVIATOR_COMPACT_CHART_MAX_HEIGHT_DP,
      usableHeight - AVIATOR_COMPACT_CONTROLS_RESERVED_HEIGHT_DP,
    ),
  );
}
