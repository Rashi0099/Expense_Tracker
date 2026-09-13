import React from 'react';
import { DateFilterPreset } from '@/types/analytics';

export interface DateRangeFilterProps {
  activePreset: DateFilterPreset;
  onSelectPreset: (preset: DateFilterPreset) => void;
}

const PRESETS: { label: string; value: DateFilterPreset }[] = [
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'Last Month', value: 'LAST_MONTH' },
  { label: 'Last 3 Months', value: 'LAST_3_MONTHS' },
  { label: 'This Year', value: 'THIS_YEAR' },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  activePreset,
  onSelectPreset,
}) => {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onSelectPreset(p.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activePreset === p.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};
