/**
 * Shift Journal / Activity Log feed styled in PMD Navy & Gold.
 */
import type { ActivityEntry } from '../data/types';

export interface ActivityLogProps {
  entries: ActivityEntry[];
}

const TONE_BADGE: Record<ActivityEntry['tone'], string> = {
  info: 'border-[#78a8f0] bg-[#142958] text-[#cfe0ff]',
  sale: 'border-[#2ecc71] bg-[#14472c] text-[#9effc3]',
  heal: 'border-[#38bdf8] bg-[#0c3a52] text-[#bae6fd]',
  breed: 'border-[#a78bfa] bg-[#2b1f52] text-[#ddd6fe]',
  shiny: 'border-[#ffd84d] bg-[#5c3e00] text-[#ffd84d]',
  warning: 'border-[#e74c3c] bg-[#4a161b] text-[#ffd4d0]',
};

export function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <section aria-label="Shift Activity Journal" className="space-y-2 text-sm text-[#e2eeff]">
      <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="pmd-inset flex items-start gap-2.5 px-3 py-2"
          >
            <span
              className={`pmd-num shrink-0 border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[entry.tone]}`}
            >
              S{entry.shift}
            </span>
            <span className="leading-snug text-[#e2eeff]">{entry.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
