import { MAX_NAME_LENGTH } from './patterns.js';

/** LIVR schema for `PATCH /budget/categories/:id`. */
export const UPDATE_CATEGORY_SCHEMA: Record<string, unknown> = {
  name: ['required', 'string', { max_length: MAX_NAME_LENGTH }],
};
