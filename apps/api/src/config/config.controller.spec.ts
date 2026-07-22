import { describe, it, expect } from 'vitest';

import { ConfigController } from './config.controller.js';
import type { ApiConfig } from './api-config.js';

const FULL_CONFIG: ApiConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'penny_test',
  jwtSecret: 'super-secret-jwt-key',
  botToken: '123456:ABCDEF',
  telegramBotUsername: 'test_bot',
  port: 4000,
  mode: 'development',
};

describe('ConfigController', () => {
  it('returns only telegramBotUsername', () => {
    const controller = new ConfigController(FULL_CONFIG);

    expect(controller.getConfig()).toEqual({
      telegramBotUsername: 'test_bot',
    });
  });

  it('never exposes botToken or any other ApiConfig field', () => {
    const controller = new ConfigController(FULL_CONFIG);

    const body = controller.getConfig();
    const serialized = JSON.stringify(body);

    expect(Object.keys(body)).toEqual(['telegramBotUsername']);
    expect(serialized).not.toContain(FULL_CONFIG.botToken);
    expect(serialized).not.toContain(FULL_CONFIG.jwtSecret);
    expect(serialized).not.toContain(FULL_CONFIG.mongoUri);
  });
});
