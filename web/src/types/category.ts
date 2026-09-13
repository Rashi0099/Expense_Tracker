export type CategoryType = 'EXPENSE' | 'INCOME';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isSystem: boolean;
  isArchived: boolean;
  createdAt?: string;
}

export interface CategoryCreateInput {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface CategoryUpdateInput {
  name?: string;
  color?: string;
  icon?: string;
}
