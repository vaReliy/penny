import nx from '@nx/eslint-plugin';
import playwright from 'eslint-plugin-playwright';

// Selector definitions live here once and are referenced everywhere below.
// ESLint flat config does NOT merge `no-restricted-syntax` across matching config
// objects — the last matching object replaces the whole array. Every block that can
// match a file must therefore re-list every selector that file should be checked
// against, which makes duplicated literals a silent-rule-loss hazard. Keep them here.
const JS_EXTENSION_SELECTORS = [
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
];

const INJECTABLE_SELECTOR = {
  selector: "Decorator > CallExpression[callee.name='Injectable']",
  message:
    'application/core layers are framework-free — no NestJS DI decorators. Wire DI in apps/* via Symbol-token factory providers.',
};

const LOCAL_STORAGE_SELECTOR = {
  selector:
    "MemberExpression[object.name='localStorage'], MemberExpression[object.object.name='window'][object.property.name='localStorage']",
  message:
    'Do not read/write auth tokens via localStorage in web libs — use the in-memory/secure token store.',
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/.angular/cache',
      '**/node_modules',
      '**/.history',
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
            {
              sourceTag: 'scope:budget',
              onlyDependOnLibsWithTags: ['scope:budget', 'scope:shared'],
            },
            // scope:web — the `apps/web` composition root only. It wires
            // together multiple domain scopes (identity nav, budget
            // screens, ...), so it needs its own tag rather than reusing an
            // exclusive domain scope: a project tagged with two exclusive
            // scopes (e.g. both `scope:identity` and `scope:budget`) would
            // have to satisfy every matching rule simultaneously, which no
            // cross-domain import could ever do.
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:web',
                'scope:identity',
                'scope:budget',
                'scope:shared',
              ],
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
                'type:contracts',
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
  // Spec files may depend on `type:testing` libs (shared in-memory fakes) —
  // production code under `type:application`/`type:core`/etc. still cannot,
  // since flat-config rule keys don't merge, this override must replicate
  // the full depConstraints set and only widen the sourceTag it targets.
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:identity',
              onlyDependOnLibsWithTags: ['scope:identity', 'scope:shared'],
            },
            {
              sourceTag: 'scope:budget',
              onlyDependOnLibsWithTags: ['scope:budget', 'scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:web',
                'scope:identity',
                'scope:budget',
                'scope:shared',
              ],
            },
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
                'type:testing',
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
                'type:testing',
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
                'type:testing',
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
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data',
                'type:util',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:util',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: [
                'type:data',
                'type:util',
                'type:contracts',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:kernel',
              onlyDependOnLibsWithTags: [
                'type:kernel',
                'type:contracts',
                'type:errors',
                'type:util',
                'type:testing',
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
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:util',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:errors',
              onlyDependOnLibsWithTags: [
                'type:errors',
                'type:util',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:validation',
              onlyDependOnLibsWithTags: [
                'type:validation',
                'type:util',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:testing'],
            },
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
    files: ['apps/*-e2e/**/*.ts', 'apps/*-e2e/**/*.js'],
    plugins: {
      playwright,
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
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
      'no-restricted-syntax': ['error', LOCAL_STORAGE_SELECTOR],
    },
  },
  // .js extension gate — backend only (NestJS apps + server/shared libs).
  // Angular's moduleResolution:bundler resolves extensionless imports silently,
  // so this rule is intentionally excluded from apps/web and platform:web libs.
  // The repo-root-anchored globs below only match under `nx lint:root` (basePath = repo
  // root). Under per-project `nx lint <project>` the project's own directory segments are
  // stripped from the path, so the trailing `src/**/*.ts` entry is what actually matches
  // there. It is deliberately layer-agnostic — once anchored at a project root, a NestJS
  // lib and an Angular lib are indistinguishable by path shape — so platform:web projects
  // opt back out via `webOnlyRestrictedSyntax` in their own eslint.config.mjs.
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
      'src/**/*.ts', // Per-project fallback (see comment above)
    ],
    rules: {
      'no-restricted-syntax': ['error', ...JS_EXTENSION_SELECTORS],
    },
  },
  // @Injectable ban — application/core/kernel layers are framework-free.
  // Separate config object to scope the rule only to these layers (not infrastructure/errors/contracts/validation/util).
  // ESLint flat config applies all matching config objects to a file; same-named rule keys don't merge.
  // This config object comes after the .js extension rules, so for files matching both globs,
  // this rule completely replaces the .js extension rules above. To avoid losing the .js extension rules
  // for these files, they are intentionally duplicated below.
  // These globs, like the ones above, only match under `nx lint:root`. Under per-project
  // lint the `injectableBanRules` export below is applied by each application/core/kernel
  // project's own eslint.config.mjs — a path-shape fallback cannot work here, because once
  // the project's directory segments are stripped an `infrastructure` lib (which legitimately
  // uses @Injectable for repository adapters) is indistinguishable from an `application` one.
  {
    files: [
      'libs/**/application/**/*.ts',
      'libs/**/core/**/*.ts',
      'libs/shared/kernel/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...JS_EXTENSION_SELECTORS,
        INJECTABLE_SELECTOR,
      ],
    },
  },
];

/**
 * Opt-in for application/core/kernel projects under per-project `nx lint`.
 * Bundles the .js-extension selectors alongside the @Injectable ban because this block
 * matches last for those files and would otherwise replace them (see the note at the top).
 */
export const injectableBanRules = {
  'no-restricted-syntax': [
    'error',
    ...JS_EXTENSION_SELECTORS,
    INJECTABLE_SELECTOR,
  ],
};

/**
 * Opt-out for platform:web projects under per-project `nx lint`.
 * The root config's `src/**` fallback cannot tell an Angular project from a NestJS one, so
 * the backend-only .js-extension gate reaches web projects; applying this last replaces it
 * with the localStorage ban alone, which is the only fuse that belongs on web code.
 */
export const webOnlyRestrictedSyntax = {
  'no-restricted-syntax': ['error', LOCAL_STORAGE_SELECTOR],
};
