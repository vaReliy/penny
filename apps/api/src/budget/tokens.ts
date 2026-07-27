/** DI injection tokens for the budget domain. */
export const TOKENS = {
  MongoConnection: Symbol('BudgetMongoConnection'),
  CategoryRepository: Symbol('ICategoryRepository'),
  MonthlyBudgetRepository: Symbol('IMonthlyBudgetRepository'),
  CreateCategory: Symbol('CreateCategoryService'),
  UpdateCategory: Symbol('UpdateCategoryService'),
  ArchiveCategory: Symbol('ArchiveCategoryService'),
  ListCategories: Symbol('ListCategoriesService'),
  UpsertMonthlyBudget: Symbol('UpsertMonthlyBudgetService'),
  ListMonthlyBudgets: Symbol('ListMonthlyBudgetsService'),
} as const;
