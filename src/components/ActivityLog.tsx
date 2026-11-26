/**
 * Recent cozy shop activity log feed.
 */
import type { ActivityEntry } from '../data/types';

export interface ActivityLogProps {
  entries: ActivityEntry[];
}

const TONE_BADGE: Record<ActivityEntry['tone'], string> = {
  info: 'bg-cream-200 text-wood-900',
  sale: 'bg-sage-100 text-sage-800',
  heal: 'bg-sky-100 text-sky-600',
  breed: 'bg-lavender-100 text-lavender-600',
  shiny: 'bg-honey-100 text-wood-900',
};

export function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <section aria-label="Cozy Shop Activity Log" className="ds-panel rounded-xl p-4">
      <h2 className="mb-2 text-sm font-extrabold text-wood-900">Shift Journal</h2>
      <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-start gap-2 rounded-lg border border-cream-200 bg-cream-100/60 px-2.5 py-1.5"
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${TONE_BADGE[entry.tone]}`}
            >
              S{entry.shift}
            </span>
            <span className="text-wood-900">{entry.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
