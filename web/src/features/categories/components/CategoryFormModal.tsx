import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Category, CategoryCreateInput, CategoryType } from '@/types/category';
import { parseApiError } from '@/utils/error';

export interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryCreateInput) => Promise<unknown>;
  initialData?: Category | null;
  isLoading?: boolean;
}

const PRESET_COLORS = [
  '#E6DE98', // Pastel yellow (from reference)
  '#B5C0EA', // Pastel blue (from reference)
  '#F4BBA6', // Pastel peach (from reference)
  '#E89EB7', // Pastel pink (from reference)
  '#A4D9C8', // Pastel mint (from reference)
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

const PRESET_ICONS = ['🛒', '👱', '🍔', '🚗', '💊', '💼', '🏠', '✈️', '🎬', '💡', '💰', '🎁'];

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setColor(initialData.color || PRESET_COLORS[0]);
      setIcon(initialData.icon || PRESET_ICONS[0]);
    } else {
      setName('');
      setType('EXPENSE');
      setColor(PRESET_COLORS[0]);
      setIcon(PRESET_ICONS[0]);
    }
    setErrorMsg(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Category name is required.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        type,
        color,
        icon,
      });
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      setErrorMsg(parsed.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Category' : 'Create Category'}
      description="Categorize your spending and revenue streams"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {errorMsg}
          </div>
        )}

        <Input
          label="Category Name"
          placeholder="e.g. Groceries, Freelance, Gym"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Select
          label="Category Type"
          value={type}
          onChange={(e) => setType(e.target.value as CategoryType)}
          options={[
            { label: 'Expense', value: 'EXPENSE' },
            { label: 'Income', value: 'INCOME' },
          ]}
          disabled={!!initialData} // Backend restrictions prevent changing type of existing categories
        />

        {/* Color Palette Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Color Theme</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? 'scale-110 border-slate-900 shadow-sm' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Emoji / Icon Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Icon Symbol</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                  icon === emoji
                    ? 'border-primary-600 bg-primary-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {initialData ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
