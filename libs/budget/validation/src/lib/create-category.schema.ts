import { MAX_NAME_LENGTH } from './patterns.js';

/** LIVR schema for `POST /budget/categories`. */
export const CREATE_CATEGORY_SCHEMA: Record<string, unknown> = {
  name: ['required', 'string', { max_length: MAX_NAME_LENGTH }],
};
