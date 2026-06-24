export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'],
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,html,css,scss,yml,yaml}': [
    'prettier --write',
  ],
};
