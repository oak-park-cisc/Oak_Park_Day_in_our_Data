import type { TreePoint } from './types';

// palette tuned for contrast on light basemap tiles in both system themes
const PALETTE = [
  '#d73027', // red
  '#4575b4', // blue
  '#1a9850', // green
  '#762a83', // purple
  '#e08214', // orange
  '#008585', // teal
  '#b2182b', // dark red
  '#5e4fa2', // indigo
];
const OTHER = '#9ca3af'; // gray

export const OTHER_LABEL = 'Other genera';

export function genusColors(points: TreePoint[]): { colors: Map<string, string>; top: string[] } {
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.g, (counts.get(p.g) ?? 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
  const colors = new Map<string, string>();
  top.forEach((name, i) => {
    colors.set(name, PALETTE[i] ?? OTHER);
  });
  return { colors, top };
}

export const colorFor = (colors: Map<string, string>, genus: string): string =>
  colors.get(genus) ?? OTHER;
