export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'],
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,html,css,scss,yml,yaml}': [
    'prettier --write',
  ],
  // Check for planning IDs (task slugs, AC numbers, slice/decision IDs, "grill" references)
  '*': ['node tools/check-planning-leaks.mjs'],
};
