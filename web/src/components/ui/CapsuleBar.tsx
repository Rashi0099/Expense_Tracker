import React from 'react';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/common/CategoryIcon';

export interface CapsuleBarProps {
  label: string;
  amount: string | number;
  percentage: number;
  icon?: React.ReactNode;
  color?: string; // hex code or pastel color class
  limit?: string | number;
  className?: string;
  isOverBudget?: boolean;
}

export const CapsuleBar: React.FC<CapsuleBarProps> = ({
  label,
  amount,
  percentage,
  icon,
  color = '#E6DE98',
  limit,
  className,
  isOverBudget = false,
}) => {
  // Clamp fill percentage between 10% (so text is readable) and 100% for container height
  const displayPercentage = Math.min(Math.max(percentage, 18), 100);

  return (
    <div
      className={cn('flex flex-col items-center gap-2', className)}
      title={limit ? `${label}: ${amount} / ${limit} (${percentage}%)` : `${label}: ${amount}`}
    >
      {/* Outer dashed capsule container */}
      <div className="relative w-20 sm:w-24 h-52 sm:h-60 rounded-[32px] capsule-dashed-outline bg-white/40 overflow-hidden flex flex-col justify-end p-1.5 shadow-sm transition-transform hover:scale-105 duration-200">
        {/* Filled solid pastel bar */}
        <div
          className="w-full rounded-[26px] transition-all duration-700 ease-out flex flex-col items-center justify-end pb-3 pt-2 px-1 text-center select-none shadow-sm"
          style={{
            height: `${displayPercentage}%`,
            backgroundColor: color,
          }}
        >
          {/* Icon or emoji */}
          <div className="mb-1 text-xl flex items-center justify-center text-slate-800 drop-shadow-sm">
            {typeof icon === 'string' ? <CategoryIcon icon={icon} className="w-5 h-5" /> : (icon || '🏷️')}
          </div>

          {/* Amount */}
          <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight font-tabular leading-tight truncate w-full">
            {typeof amount === 'number' ? `$${amount.toLocaleString()}` : amount}
          </span>

          {/* Percentage */}
          <span className="text-[10px] sm:text-xs font-semibold text-slate-700/80 font-tabular mt-0.5">
            {Math.round(percentage)}%
          </span>
        </div>

        {/* Warning dot if over budget */}
        {isOverBudget && (
          <div
            className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"
            title="Budget exceeded"
          />
        )}
      </div>

      {/* Category Label below capsule */}
      <span
        className="text-xs font-medium text-slate-600 truncate max-w-[90px] text-center"
        title={label}
      >
        {label}
      </span>
    </div>
  );
};
