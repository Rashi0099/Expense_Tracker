import { CategoryModel, CategoryType } from '../../../domain/models';

export interface CreateCategoryParams {
  id?: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
}

export interface ICategoryRepository {
  create(params: CreateCategoryParams): Promise<CategoryModel>;
  getById(id: string): Promise<CategoryModel | null>;
  list(type?: CategoryType): Promise<CategoryModel[]>;
  seedDefaults(): Promise<void>;
}
