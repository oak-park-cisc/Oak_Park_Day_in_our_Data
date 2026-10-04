import { STATUS_META } from '../lib/status';
import type { BlockStatus } from '../lib/types';

export default function StatusIcon({ status }: { status: BlockStatus }) {
  const path =
    status === 'risk'
      ? 'M10 2 1 18h18L10 2Zm-1 6h2v5H9V8Zm0 6h2v2H9v-2Z'
      : status === 'cusp'
        ? 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 4h2v6H9V6Zm0 7h2v2H9v-2Z'
        : status === 'meets'
          ? 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1.2 11.4L5 9.6l1.4-1.4 2.4 2.4 4.8-4.8L15 7.2l-6.2 6.2Z'
          : 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-4 7h8v2H6V9Z';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4 shrink-0"
      style={{ fill: STATUS_META[status].color }}
    >
      <path d={path} />
    </svg>
  );
}
