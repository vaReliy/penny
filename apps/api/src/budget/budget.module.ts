import { Injectable, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type pino from 'pino';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  MongoAccountRepository,
  MongoCategoryRepository,
  MongoMonthlyBudgetRepository,
  MongoTransactionRepository,
  MonobankCurrencyClient,
  GetExchangeRatesService,
} from 'budget-infrastructure';
import {
  CreateCategoryService,
  UpdateCategoryService,
  ArchiveCategoryService,
  ListCategoriesService,
  UpsertMonthlyBudgetService,
  ListMonthlyBudgetsService,
  RecordTransactionService,
  ListTransactionsService,
  GetTransactionService,
  GetBalanceService,
  GetPlannerSummaryService,
  GetHistoryChartService,
} from 'budget-application';
import type {
  IAccountRepository,
  ICategoryRepository,
  IMonthlyBudgetRepository,
  ITransactionRepository,
} from 'budget-core';

import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from './tokens.js';
import { CategoriesController } from './categories.controller.js';
import { MonthlyBudgetsController } from './monthly-budgets.controller.js';
import { TransactionsController } from './transactions.controller.js';
import { BudgetAnalyticsController } from './budget-analytics.controller.js';
import { RatesController } from './rates.controller.js';

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
  controllers: [
    CategoriesController,
    MonthlyBudgetsController,
    TransactionsController,
    BudgetAnalyticsController,
    RatesController,
  ],
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
      provide: TOKENS.AccountRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): IAccountRepository => new MongoAccountRepository(connection, logger),
      inject: [TOKENS.MongoConnection, PINO_LOGGER],
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
      provide: TOKENS.TransactionRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): ITransactionRepository =>
        new MongoTransactionRepository(connection, logger),
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
    {
      provide: TOKENS.RecordTransaction,
      useFactory: (
        transactionRepository: ITransactionRepository,
        categoryRepository: ICategoryRepository,
      ): RecordTransactionService =>
        new RecordTransactionService({
          transactionRepository,
          categoryRepository,
        }),
      inject: [TOKENS.TransactionRepository, TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.ListTransactions,
      useFactory: (
        transactionRepository: ITransactionRepository,
      ): ListTransactionsService =>
        new ListTransactionsService({ transactionRepository }),
      inject: [TOKENS.TransactionRepository],
    },
    {
      provide: TOKENS.GetTransaction,
      useFactory: (
        transactionRepository: ITransactionRepository,
      ): GetTransactionService =>
        new GetTransactionService({ transactionRepository }),
      inject: [TOKENS.TransactionRepository],
    },
    {
      provide: TOKENS.GetBalance,
      useFactory: (
        accountRepository: IAccountRepository,
        transactionRepository: ITransactionRepository,
      ): GetBalanceService =>
        new GetBalanceService({ accountRepository, transactionRepository }),
      inject: [TOKENS.AccountRepository, TOKENS.TransactionRepository],
    },
    {
      provide: TOKENS.GetPlannerSummary,
      useFactory: (
        monthlyBudgetRepository: IMonthlyBudgetRepository,
        transactionRepository: ITransactionRepository,
      ): GetPlannerSummaryService =>
        new GetPlannerSummaryService({
          monthlyBudgetRepository,
          transactionRepository,
        }),
      inject: [TOKENS.MonthlyBudgetRepository, TOKENS.TransactionRepository],
    },
    {
      provide: TOKENS.GetHistoryChart,
      useFactory: (
        transactionRepository: ITransactionRepository,
        categoryRepository: ICategoryRepository,
      ): GetHistoryChartService =>
        new GetHistoryChartService({
          transactionRepository,
          categoryRepository,
        }),
      inject: [TOKENS.TransactionRepository, TOKENS.CategoryRepository],
    },
    {
      provide: TOKENS.GetExchangeRates,
      // `GetExchangeRatesService`/`MonobankCurrencyClient` are framework-free
      // `budget-infrastructure` classes (no DI decorators, see
      // `get-exchange-rates.service.ts`) — constructed directly here, same
      // as every other budget service provider, rather than registered as
      // their own `@Injectable()`s.
      useFactory: (): GetExchangeRatesService =>
        new GetExchangeRatesService(new MonobankCurrencyClient()),
      inject: [],
    },
    BudgetMongoShutdownHook,
  ],
  exports: [
    TOKENS.MongoConnection,
    TOKENS.AccountRepository,
    TOKENS.CategoryRepository,
    TOKENS.MonthlyBudgetRepository,
    TOKENS.TransactionRepository,
    TOKENS.CreateCategory,
    TOKENS.UpdateCategory,
    TOKENS.ArchiveCategory,
    TOKENS.ListCategories,
    TOKENS.UpsertMonthlyBudget,
    TOKENS.ListMonthlyBudgets,
    TOKENS.RecordTransaction,
    TOKENS.ListTransactions,
    TOKENS.GetTransaction,
    TOKENS.GetBalance,
    TOKENS.GetPlannerSummary,
    TOKENS.GetHistoryChart,
    TOKENS.GetExchangeRates,
  ],
})
export class BudgetModule {}
