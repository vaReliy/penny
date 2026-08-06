import { describe, expect, test, beforeAll } from 'vitest';
import axios from 'axios';

describe('API e2e', () => {
  beforeAll(() => {
    const host = process.env['HOST'] ?? 'localhost';
    const port = process.env['PORT'] ?? '3000';
    axios.defaults.baseURL = `http://${host}:${port}`;
  });

  test('health endpoint should respond', async () => {
    const res = await axios.get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.data).toHaveProperty('status');
  });
});
