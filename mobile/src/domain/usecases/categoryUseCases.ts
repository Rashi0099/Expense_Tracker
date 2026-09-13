/**
 * Category Domain Use Cases (Section 26 & 38)
 */

import { SQLiteCategoryRepository } from '../../database/repositories/SQLiteCategoryRepository';
import { CreateCategoryParams } from '../../database/repositories/interfaces/ICategoryRepository';
import { CategoryModel, CategoryType } from '../models';
import { DataEvents } from '../../database/sqlite/DataEvents';

export async function listCategoriesUseCase(
  type?: CategoryType,
  repo = new SQLiteCategoryRepository()
): Promise<CategoryModel[]> {
  return repo.list(type);
}

export async function getCategoryByIdUseCase(
  id: string,
  repo = new SQLiteCategoryRepository()
): Promise<CategoryModel | null> {
  return repo.getById(id);
}

export async function createCategoryUseCase(
  params: CreateCategoryParams,
  repo = new SQLiteCategoryRepository()
): Promise<CategoryModel> {
  if (!params.name || params.name.trim() === '') {
    throw new Error('Category name is required.');
  }

  const created = await repo.create(params);
  DataEvents.notify('CATEGORIES_CHANGED');
  return created;
}
