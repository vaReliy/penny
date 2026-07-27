import { Injectable, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type pino from 'pino';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  MongoCategoryRepository,
  MongoMonthlyBudgetRepository,
} from 'budget-infrastructure';
import {
  CreateCategoryService,
  UpdateCategoryService,
  ArchiveCategoryService,
  ListCategoriesService,
  UpsertMonthlyBudgetService,
  ListMonthlyBudgetsService,
} from 'budget-application';
import type {
  ICategoryRepository,
  IMonthlyBudgetRepository,
} from 'budget-core';

import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from './tokens.js';
import { CategoriesController } from './categories.controller.js';
import { MonthlyBudgetsController } from './monthly-budgets.controller.js';

@Injectable()
class BudgetMongoShutdownHook implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.MongoConnection) private readonly conn: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await disconnectMongoConnection(this.conn);
  }
}

/**
 * Wires the budget vertical's `application` services to `infrastructure`
 * repos, mirroring `IdentityModule`'s Symbol-token factory-provider pattern.
 * Owns its own Mongo connection — `budget-infrastructure`'s
 * `createMongoConnection` is a deliberate, independent duplicate of
 * `identity-infrastructure`'s (cross-scope import is fenced by the
 * `scope:budget`/`scope:identity` ESLint boundary), so this module cannot
 * reuse `IdentityModule`'s connection.
 */
@Module({
  imports: [LoggerModule],
  controllers: [CategoriesController, MonthlyBudgetsController],
  providers: [
    {
      provide: TOKENS.MongoConnection,
      useFactory: async (config: ApiConfig): Promise<Connection> =>
        createMongoConnection({
          uri: config.mongoUri,
          dbName: config.mongoDbName,
        }),
      inject: [API_CONFIG],
    },
    {
      provide: TOKENS.CategoryRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): ICategoryRepository => new MongoCategoryRepository(connection, logger),
      inject: [TOKENS.MongoConnection, PINO_LOGGER],
    },
    {
      provide: TOKENS.MonthlyBudgetRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): IMonthlyBudgetRepository =>
        new MongoMonthlyBudgetRepository(connection, logger),
      inject: [TOKENS.MongoConnection, PINO_LOGGER],
    },
    {
      provide: TOKENS.CreateCategory,
      useFactory: (
        categoryRepository: ICategoryRepository,
      ): CreateCategoryService =>
        new CreateCategoryService({ categoryRepository }),
      inject: [TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.UpdateCategory,
      useFactory: (
        categoryRepository: ICategoryRepository,
      ): UpdateCategoryService =>
        new UpdateCategoryService({ categoryRepository }),
      inject: [TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.ArchiveCategory,
      useFactory: (
        categoryRepository: ICategoryRepository,
      ): ArchiveCategoryService =>
        new ArchiveCategoryService({ categoryRepository }),
      inject: [TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.ListCategories,
      useFactory: (
        categoryRepository: ICategoryRepository,
      ): ListCategoriesService =>
        new ListCategoriesService({ categoryRepository }),
      inject: [TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.UpsertMonthlyBudget,
      useFactory: (
        monthlyBudgetRepository: IMonthlyBudgetRepository,
      ): UpsertMonthlyBudgetService =>
        new UpsertMonthlyBudgetService({ monthlyBudgetRepository }),
      inject: [TOKENS.MonthlyBudgetRepository],
    },
    {
      provide: TOKENS.ListMonthlyBudgets,
      useFactory: (
        monthlyBudgetRepository: IMonthlyBudgetRepository,
      ): ListMonthlyBudgetsService =>
        new ListMonthlyBudgetsService({ monthlyBudgetRepository }),
      inject: [TOKENS.MonthlyBudgetRepository],
    },
    BudgetMongoShutdownHook,
  ],
  exports: [
    TOKENS.MongoConnection,
    TOKENS.CategoryRepository,
    TOKENS.MonthlyBudgetRepository,
    TOKENS.CreateCategory,
    TOKENS.UpdateCategory,
    TOKENS.ArchiveCategory,
    TOKENS.ListCategories,
    TOKENS.UpsertMonthlyBudget,
    TOKENS.ListMonthlyBudgets,
  ],
})
export class BudgetModule {}
