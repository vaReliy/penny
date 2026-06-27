import 'reflect-metadata';

import { CommandFactory } from 'nest-commander';

import { registerLivrRules } from 'shared-kernel';

import { AppModule } from './app/app.module.js';

registerLivrRules();

async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, { logger: false });
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal CLI error', err);
  process.exit(1);
});
