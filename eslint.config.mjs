import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // scope: domain isolation (cross-domain only via scope:shared)
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:identity',
              onlyDependOnLibsWithTags: ['scope:identity', 'scope:shared'],
            },
            // platform: web ⊥ server; both may use shared
            {
              sourceTag: 'platform:shared',
              onlyDependOnLibsWithTags: ['platform:shared'],
            },
            {
              sourceTag: 'platform:server',
              onlyDependOnLibsWithTags: ['platform:server', 'platform:shared'],
            },
            {
              sourceTag: 'platform:web',
              onlyDependOnLibsWithTags: ['platform:web', 'platform:shared'],
            },
            // type: onion (backend)
            {
              sourceTag: 'type:infrastructure',
              onlyDependOnLibsWithTags: [
                'type:infrastructure',
                'type:application',
                'type:core',
                'type:contracts',
                'type:kernel',
                'type:errors',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:application',
              onlyDependOnLibsWithTags: [
                'type:application',
                'type:core',
                'type:contracts',
                'type:kernel',
                'type:errors',
                'type:util',
                'type:validation',
              ],
              bannedExternalImports: [
                '@nestjs/*',
                '@angular/*',
                'mongoose',
                'mongodb',
                '@typegoose/*',
              ],
            },
            {
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: [
                'type:core',
                'type:contracts',
                'type:kernel',
                'type:errors',
                'type:util',
              ],
              bannedExternalImports: [
                '@nestjs/*',
                '@angular/*',
                'mongoose',
                'mongodb',
                '@typegoose/*',
              ],
            },
            // type: onion (frontend)
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util'],
            },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: [
                'type:data',
                'type:util',
                'type:contracts',
              ],
            },
            // type: shared leaves
            {
              sourceTag: 'type:kernel',
              onlyDependOnLibsWithTags: [
                'type:kernel',
                'type:errors',
                'type:util',
              ],
              bannedExternalImports: [
                '@nestjs/*',
                '@angular/*',
                'mongoose',
                'mongodb',
                '@typegoose/*',
              ],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: ['type:contracts', 'type:util'],
            },
            {
              sourceTag: 'type:errors',
              onlyDependOnLibsWithTags: ['type:errors', 'type:util'],
            },
            {
              sourceTag: 'type:validation',
              onlyDependOnLibsWithTags: ['type:validation', 'type:util'],
            },
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/vite.config.*', '**/vitest.config.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@nx/vite/plugins/nx-tsconfig-paths.plugin',
              message:
                'Deprecated, removed in Nx v24 — use `resolve.tsconfigPaths: true` in the Vite config instead.',
            },
            {
              name: '@nx/vite/plugins/nx-copy-assets.plugin',
              message:
                "Deprecated, removed in Nx v24 — use Vite's `publicDir` option or `vite-plugin-static-copy` instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'libs/*/feature/**/*.ts',
      'libs/*/feature-*/**/*.ts',
      'libs/*/ui/**/*.ts',
      'libs/*/ui-*/**/*.ts',
      'libs/*/data/**/*.ts',
      'libs/*/data-*/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='localStorage'], MemberExpression[object.object.name='window'][object.property.name='localStorage']",
          message:
            'Do not read/write auth tokens via localStorage in web libs — use the in-memory/secure token store.',
        },
      ],
    },
  },
  // .js extension gate — backend only (NestJS apps + server/shared libs).
  // Angular's moduleResolution:bundler resolves extensionless imports silently,
  // so this rule is intentionally excluded from apps/web and platform:web libs.
  {
    files: [
      'apps/api/**/*.ts',
      'apps/cli/**/*.ts',
      'libs/**/core/**/*.ts',
      'libs/**/application/**/*.ts',
      'libs/**/infrastructure/**/*.ts',
      'libs/**/kernel/**/*.ts',
      'libs/**/errors/**/*.ts',
      'libs/**/contracts/**/*.ts',
      'libs/**/validation/**/*.ts',
      'libs/**/util/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^\\.\\.?\\//]:not([source.value=/\\.js$/])',
          message:
            'Relative imports must use the .js extension (NodeNext idiom). Add .js to the specifier.',
        },
        {
          selector:
            'ExportNamedDeclaration[source.value=/^\\.\\.?\\//]:not([source.value=/\\.js$/])',
          message:
            'Relative re-exports must use the .js extension (NodeNext idiom). Add .js to the specifier.',
        },
        {
          selector:
            'ExportAllDeclaration[source.value=/^\\.\\.?\\//]:not([source.value=/\\.js$/])',
          message:
            'Relative re-exports must use the .js extension (NodeNext idiom). Add .js to the specifier.',
        },
      ],
    },
  },
];
