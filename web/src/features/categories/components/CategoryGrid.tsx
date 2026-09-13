import React from 'react';
import { Category } from '@/types/category';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2, Lock } from 'lucide-react';

export interface CategoryGridProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((cat) => (
        <Card key={cat.id} hoverable className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0"
              style={{ backgroundColor: cat.color ? `${cat.color}33` : '#EEF2F6' }}
            >
              <span>{cat.icon || '🏷️'}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-slate-900 truncate">{cat.name}</h4>
                {cat.isSystem && (
                  <span title="System default category">
                    <Lock className="w-3 h-3 text-slate-400" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={cat.type === 'EXPENSE' ? 'neutral' : 'success'} size="sm">
                  {cat.type === 'EXPENSE' ? 'Expense' : 'Income'}
                </Badge>
                {cat.isSystem ? (
                  <span className="text-[10px] text-slate-400 font-medium">Default</span>
                ) : (
                  <span className="text-[10px] text-indigo-600 font-medium">Custom</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!cat.isSystem && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(cat)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={`Edit ${cat.name}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(cat)}
                  className="p-1.5 text-slate-400 hover:text-rose-600"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
