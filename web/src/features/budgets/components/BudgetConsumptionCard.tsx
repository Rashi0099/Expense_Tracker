import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/currency';
import { Edit2, Trash2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface BudgetConsumptionCardProps {
  id: string;
  title: string;
  limitAmount: string;
  spent: string;
  remaining: string;
  percentageUsed: number;
  currency: string;
  icon?: string;
  color?: string;
  isOverall?: boolean;
  onEdit: (id: string, currentLimit: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
}

export const BudgetConsumptionCard: React.FC<BudgetConsumptionCardProps> = ({
  id,
  title,
  limitAmount,
  spent,
  remaining,
  percentageUsed,
  currency,
  icon,
  color,
  isOverall = false,
  onEdit,
  onDelete,
}) => {
  const isOver = percentageUsed > 100;
  const isNear = percentageUsed >= 80 && percentageUsed <= 100;

  const statusVariant = isOver ? 'danger' : isNear ? 'warning' : 'success';
  const statusLabel = isOver ? 'Over Budget' : isNear ? 'Near Limit' : 'On Track';
  const StatusIcon = isOver ? AlertCircle : isNear ? AlertTriangle : CheckCircle2;

  const barColor = isOver ? '#E11D48' : isNear ? '#F59E0B' : color || '#10B981';

  return (
    <Card hoverable className={`p-5 space-y-4 ${isOverall ? 'border-primary-200 bg-primary-50/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0"
            style={{ backgroundColor: color ? `${color}25` : '#EEF2F6' }}
          >
            <span>{icon || (isOverall ? '🎯' : '🏷️')}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">{title}</h4>
              {isOverall && (
                <Badge variant="info" size="sm">
                  Monthly Overall
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Limit: <span className="font-semibold text-slate-700">{formatCurrency(limitAmount, currency)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(id, limitAmount, title)}
            className="p-1.5 text-slate-400 hover:text-slate-700"
            aria-label={`Edit ${title} budget`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(id, title)}
            className="p-1.5 text-slate-400 hover:text-rose-600"
            aria-label={`Delete ${title} budget`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Bar with accessible textual details */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-500">
            Spent: <span className="font-bold text-slate-800">{formatCurrency(spent, currency)}</span>
          </span>
          <span className="flex items-center gap-1">
            <StatusIcon
              className={`w-3.5 h-3.5 ${
                isOver ? 'text-rose-600' : isNear ? 'text-amber-500' : 'text-emerald-500'
              }`}
            />
            <span
              className={`font-bold font-tabular ${
                isOver ? 'text-rose-600' : isNear ? 'text-amber-600' : 'text-slate-700'
              }`}
            >
              {percentageUsed.toFixed(1)}%
            </span>
          </span>
        </div>

        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, percentageUsed)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>

      {/* Bottom Summary Pill */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <Badge variant={statusVariant} size="sm">
          {statusLabel}
        </Badge>
        <div className="text-slate-500 text-xs">
          {isOver ? (
            <span className="text-rose-600 font-bold">
              Over by {formatCurrency(Math.abs(parseFloat(remaining)), currency)}
            </span>
          ) : (
            <span>
              Remaining:{' '}
              <span className="font-bold text-slate-900">{formatCurrency(remaining, currency)}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
