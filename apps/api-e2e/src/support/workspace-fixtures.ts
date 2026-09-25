import { randomBytes } from 'node:crypto';

import axios from 'axios';
import type { AxiosResponse, Method } from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { Connection } from 'mongoose';

/** Session token lifetime for e2e callers — one hour, the API's default session TTL. */
const SESSION_TOKEN_TTL_SECONDS = 3_600;

/** Byte length of the random CSRF synchronizer value, matching the API's own login flow. */
const XSRF_TOKEN_BYTES = 32;

/** Name of the httpOnly session cookie the API reads. */
const AUTH_COOKIE_NAME = 'token';

/** Name of the readable CSRF cookie, mirrored into {@link XSRF_HEADER_NAME} on mutating requests. */
const XSRF_COOKIE_NAME = 'XSRF-TOKEN';

/** Header Angular's HttpClient copies the CSRF cookie into for mutating requests. */
const XSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/** HTTP methods the API's CSRF guard treats as safe (no header required). */
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Currency every seeded budget document is denominated in. */
const SEED_CURRENCY = 'UAH';

/** Name the API resolves as a workspace's default account. */
const DEFAULT_ACCOUNT_NAME = 'Main';

/** Secondary account that receives every test-driven transaction write, so the default account's balance stays at its seeded value. */
const SCRATCH_ACCOUNT_NAME = 'Scratch';

/** Month every seeded transaction/monthly budget belongs to. */
export const SEEDED_MONTH = '2026-01';

/** Economic date of every seeded transaction (inside {@link SEEDED_MONTH}). */
const SEEDED_DATE = '2026-01-15';

/** Month every test-driven write targets, kept apart from {@link SEEDED_MONTH}. */
export const WRITE_MONTH = '2026-02';

/** Economic date of every test-driven transaction write (inside {@link WRITE_MONTH}). */
export const WRITE_DATE = '2026-02-10';

/** Amount of WA's single seeded expense, in minor units. */
export const WA_EXPENSE_MINOR_UNITS = 1_500;

/** Amount of WA's seeded monthly budget, in minor units. */
export const WA_BUDGET_MINOR_UNITS = 5_000;

/** Amount of WB's single seeded expense — deliberately distinct from WA's so any leak shows in WA's totals. */
export const WB_EXPENSE_MINOR_UNITS = 700_000;

/** Amount of WB's seeded monthly budget, in minor units. */
export const WB_BUDGET_MINOR_UNITS = 90_000;

/** Amount used by test-driven transaction and monthly-budget writes, in minor units. */
export const WRITE_AMOUNT_MINOR_UNITS = 250;

/** An authenticated e2e caller. */
export interface TestUser {
  readonly id: string;
  readonly token: string;
  readonly xsrf: string;
}

/** A workspace seeded with one member and one of each budget document. */
export interface SeededWorkspace {
  readonly id: string;
  readonly name: string;
  readonly grantedAt: Date;
  readonly accountId: string;
  readonly scratchAccountId: string;
  readonly categoryId: string;
  readonly transactionId: string;
  readonly monthlyBudgetId: string;
}

/** Everything the isolation suite seeds for one run. */
export interface IsolationFixture {
  readonly connection: Connection;
  readonly runId: string;
  /** Admin member of `wa` only. */
  readonly userA: TestUser;
  /** Admin member of `wb` only. */
  readonly userB: TestUser;
  /** SUPERADMIN, member of neither workspace. */
  readonly superadmin: TestUser;
  readonly wa: SeededWorkspace;
  readonly wb: SeededWorkspace;
  /** Valid ObjectId that names no workspace. */
  readonly ghostWorkspaceId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing env var ${name} — source .env before running api-e2e (the API and this fixture must share it).`,
    );
  }
  return value;
}

function newId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

function mintSessionToken(
  secret: string,
  userId: string,
  roles: readonly string[],
): string {
  return jwt.sign({ status: 'active', roles }, secret, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: SESSION_TOKEN_TTL_SECONDS,
  });
}

async function seedUser(
  connection: Connection,
  secret: string,
  telegramId: string,
  roles: readonly string[],
): Promise<TestUser> {
  const _id = newId();
  const now = new Date();
  await connection.collection('users').insertOne({
    _id,
    telegramId,
    firstName: `e2e ${telegramId}`,
    status: 'active',
    roles: [...roles],
    createdAt: now,
    updatedAt: now,
  });
  const id = _id.toHexString();
  return {
    id,
    token: mintSessionToken(secret, id, roles),
    xsrf: randomBytes(XSRF_TOKEN_BYTES).toString('hex'),
  };
}

async function seedAccount(
  connection: Connection,
  workspaceId: string,
  name: string,
): Promise<string> {
  const _id = newId();
  await connection.collection('accounts').insertOne({
    _id,
    workspaceId,
    name,
    currency: SEED_CURRENCY,
    createdAt: new Date(),
  });
  return _id.toHexString();
}

/** Inserts a fresh active category into `workspaceId` and returns its id. */
export async function seedCategory(
  connection: Connection,
  workspaceId: string,
  name: string,
): Promise<string> {
  const _id = newId();
  await connection.collection('categories').insertOne({
    _id,
    workspaceId,
    name,
  });
  return _id.toHexString();
}

async function seedWorkspace(
  connection: Connection,
  name: string,
  admin: TestUser,
  expenseMinorUnits: number,
  budgetMinorUnits: number,
): Promise<SeededWorkspace> {
  const _id = newId();
  const id = _id.toHexString();
  const grantedAt = new Date();
  await connection.collection('workspaces').insertOne({
    _id,
    name,
    members: [
      { userId: admin.id, role: 'admin', grantedAt, grantedBy: admin.id },
    ],
    version: 0,
    createdAt: grantedAt,
    updatedAt: grantedAt,
  });

  const accountId = await seedAccount(connection, id, DEFAULT_ACCOUNT_NAME);
  const scratchAccountId = await seedAccount(
    connection,
    id,
    SCRATCH_ACCOUNT_NAME,
  );
  const categoryId = await seedCategory(connection, id, `${name} groceries`);

  const transactionOid = newId();
  await connection.collection('transactions').insertOne({
    _id: transactionOid,
    workspaceId: id,
    accountId,
    categoryId,
    type: 'expense',
    amount: mongoose.mongo.Long.fromNumber(expenseMinorUnits),
    currency: SEED_CURRENCY,
    date: new Date(SEEDED_DATE),
    createdBy: admin.id,
    createdAt: new Date(),
  });

  const monthlyBudgetOid = newId();
  await connection.collection('monthlyBudgets').insertOne({
    _id: monthlyBudgetOid,
    workspaceId: id,
    categoryId,
    month: SEEDED_MONTH,
    amount: mongoose.mongo.Long.fromNumber(budgetMinorUnits),
    currency: SEED_CURRENCY,
  });

  return {
    id,
    name,
    grantedAt,
    accountId,
    scratchAccountId,
    categoryId,
    transactionId: transactionOid.toHexString(),
    monthlyBudgetId: monthlyBudgetOid.toHexString(),
  };
}

/**
 * Seeds three ACTIVE users and two single-member workspaces with budget data
 * directly into the API's Mongo database, and mints session tokens exactly as
 * the CLI's `dev:token` command does (HS256 over `{ status, roles }`, `sub` =
 * user id, signed with `JWT_SECRET`).
 */
export async function seedIsolationFixture(): Promise<IsolationFixture> {
  const uri = requireEnv('MONGO_URI');
  const dbName = requireEnv('MONGO_DB_NAME');
  const secret = requireEnv('JWT_SECRET');

  const connection = await mongoose
    .createConnection(uri, { dbName })
    .asPromise();
  const runId = randomBytes(4).toString('hex');

  const userA = await seedUser(connection, secret, `e2e-iso-${runId}-a`, []);
  const userB = await seedUser(connection, secret, `e2e-iso-${runId}-b`, []);
  const superadmin = await seedUser(connection, secret, `e2e-iso-${runId}-s`, [
    'superadmin',
  ]);

  const wa = await seedWorkspace(
    connection,
    `e2e-iso-${runId} WA`,
    userA,
    WA_EXPENSE_MINOR_UNITS,
    WA_BUDGET_MINOR_UNITS,
  );
  const wb = await seedWorkspace(
    connection,
    `e2e-iso-${runId} WB`,
    userB,
    WB_EXPENSE_MINOR_UNITS,
    WB_BUDGET_MINOR_UNITS,
  );

  return {
    connection,
    runId,
    userA,
    userB,
    superadmin,
    wa,
    wb,
    ghostWorkspaceId: newId().toHexString(),
  };
}

/**
 * Deletes everything this run seeded or caused the API to write: users and
 * workspaces by `_id`, budget documents by this run's workspace ids.
 */
export async function cleanupIsolationFixture(
  fixture: IsolationFixture | undefined,
): Promise<void> {
  if (!fixture) {
    return;
  }
  const { connection } = fixture;
  const userIds = [fixture.userA, fixture.userB, fixture.superadmin].map(
    (user) => new mongoose.Types.ObjectId(user.id),
  );
  const workspaceIds = [fixture.wa.id, fixture.wb.id, fixture.ghostWorkspaceId];

  await connection.collection('users').deleteMany({ _id: { $in: userIds } });
  await connection.collection('workspaces').deleteMany({
    _id: { $in: workspaceIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  for (const collection of [
    'accounts',
    'categories',
    'transactions',
    'monthlyBudgets',
  ]) {
    await connection
      .collection(collection)
      .deleteMany({ workspaceId: { $in: workspaceIds } });
  }
  await connection.close();
}

/**
 * Sends a request as `user` the way the web client does: session and CSRF
 * cookies on every request, the CSRF value mirrored into `X-XSRF-TOKEN` on
 * mutating ones. Never throws on a non-2xx status.
 */
export async function apiRequest(
  user: TestUser,
  method: Method,
  url: string,
  body?: unknown,
): Promise<AxiosResponse> {
  const headers: Record<string, string> = {
    Cookie: `${AUTH_COOKIE_NAME}=${user.token}; ${XSRF_COOKIE_NAME}=${user.xsrf}`,
  };
  if (!SAFE_METHODS.has(method.toUpperCase())) {
    headers[XSRF_HEADER_NAME] = user.xsrf;
  }
  return axios.request({
    method,
    url,
    data: body,
    headers,
    validateStatus: () => true,
  });
}
