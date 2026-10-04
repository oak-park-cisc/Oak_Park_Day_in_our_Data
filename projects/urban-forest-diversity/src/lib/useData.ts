import { useEffect, useState } from 'react';
import type { AppData, Block, BlockGroup, Park, Village } from './types';

interface BlockSummary {
  village: Village;
  boundary: AppData['boundary'];
  blocks: Block[];
  parks: Park[];
  vulnerability: BlockGroup[];
  names: AppData['names'];
}

export function useData(): { data: AppData | null; error: string | null } {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/data/block-summary.json').then((r) => r.json() as Promise<BlockSummary>),
      fetch('/data/tree-points.json').then((r) => r.json() as Promise<AppData['points']>),
    ])
      .then(([summary, points]) => {
        if (cancelled) return;
        setData({ ...summary, points });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load tree data. Try refreshing.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
