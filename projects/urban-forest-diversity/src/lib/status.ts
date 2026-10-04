import type { BlockStatus } from './types';

export const STATUS_META: Record<BlockStatus, { label: string; color: string }> = {
  risk: { label: 'At risk', color: '#dc2626' },
  cusp: { label: 'On the cusp', color: '#f59e0b' },
  meets: { label: 'Meets guideline', color: '#16a34a' },
  few: { label: 'Too few trees', color: '#9ca3af' },
};

export const STATUS_ORDER: BlockStatus[] = ['risk', 'cusp', 'meets', 'few'];

// park outlines (OpenStreetMap) are context only; olive-lime so they never
// read as "meets guideline"
export const PARK_COLOR = '#84cc16';
export const PARK_EDGE = '#4d7c0f';
