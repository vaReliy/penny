import { describe, expect, test } from 'vitest';
import axios from 'axios';

describe('API e2e', () => {
  test('health endpoint should respond', async () => {
    const res = await axios.get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.data).toHaveProperty('status');
  });
});
