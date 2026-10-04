// single-hue green ramp, light (least canopy) → dark (most); the lightest
// step stays saturated enough to read as a line on the light basemap
export const CANOPY_COLORS = ['#86efac', '#22c55e', '#15803d', '#14532d', '#052e16'];
export const CANOPY_LABELS = ['Least shade', 'Less', 'Middle', 'More', 'Most shade'];

// quintile (0–4) of a block's canopy per 100 ft of street
export function canopyStep(value: number | null, breaks: number[]): number | null {
  if (value === null) return null;
  const i = breaks.findIndex((b) => value < b);
  return i === -1 ? breaks.length : i;
}

// share of blocks with less canopy per 100 ft than this value
export function canopyPercentile(value: number, sorted: number[]): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] ?? 0) < value) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length ? lo / sorted.length : 0;
}
