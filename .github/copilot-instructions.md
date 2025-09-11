# Penny - Ukrainian Home Finance Tracking Application

Penny is an Angular 16 educational web application for personal finance management with a Ukrainian interface. It includes expense/income tracking, budget categories, currency exchange rates, and financial planning features.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Install Dependencies
- **REQUIRED**: Use legacy peer dependencies to resolve version conflicts:
  ```bash
  npm install --legacy-peer-deps
  ```
- **Time**: Takes ~1 minute to complete
- **Issues**: Standard `npm install` fails due to tslint/codelyzer version conflicts

### Build Commands
- **Development build**:
  ```bash
  npm run build
  ```
  - **Time**: Takes ~20 seconds. NEVER CANCEL.
  - **Output**: Creates `dist/penny/` directory with unoptimized bundles

- **Production build**:
  ```bash
  npm run prod
  ```
  - **Time**: Takes ~25 seconds. NEVER CANCEL.  
  - **Output**: Creates optimized, minified bundles with hash names

### Development Server
- **Full application** (recommended):
  ```bash
  npm run dev
  ```
  - Starts both json-server (port 3201) and Angular dev server (port 4201) concurrently
  - **Time**: Takes ~17 seconds to start both servers. NEVER CANCEL.
  - **Access**: http://localhost:4201

- **Angular only**:
  ```bash
  npm run start
  ```
  - Starts only Angular dev server on port 4201

- **Backend only**:
  ```bash
  npm run server
  ```
  - Starts only json-server on port 3201

### Testing and Quality
- **Unit tests**:
  ```bash
  npm run test -- --watch=false --browsers=ChromeHeadless
  ```
  - **Status**: FAILS - existing test configuration issues with zone.js/testing setup
  - **Time**: Takes ~10 seconds but fails with zone.js errors
  - **Note**: Tests exist but are broken. Do not rely on unit tests for validation.

- **Linting**:
  ```bash
  npm run lint
  ```
  - **Time**: Takes ~3 seconds
  - **Status**: WORKS - produces warnings about `any` types in base-api.ts but passes
  - Always run before committing changes

- **E2E tests**: Available via Protractor but deprecated
  ```bash
  npm run e2e
  ```
  - **Note**: Protractor is deprecated, consider manual validation instead

## Validation Scenarios

After making changes, always manually validate the application functionality:

### Complete Login and Navigation Flow
1. **Start the application**: `npm run dev`
2. **Login test**:
   - Navigate to http://localhost:4201 (redirects to /login)
   - Enter credentials: 
     - Email: `admin@gmail.com`
     - Password: `12345678`
   - Click "Увійти" (Login)
   - Should redirect to `/system/bill` (Account page)

3. **Navigation test**:
   - **Рахунок (Account)**: Shows balance in UAH/USD/EUR and exchange rates
   - **Історія (History)**: Transaction history (may show loading state)
   - **Планувальник (Planner)**: Budget planning features
   - **Записи (Records)**: Add income/expenses and manage categories

### Key Application Features to Test
- **Financial data**: Check that mock data loads from db.json (users, categories, events)
- **Form functionality**: Test adding new transactions in Records section
- **Currency display**: Verify UAH/USD/EUR rates and balance calculations
- **Responsive design**: Application uses Bootstrap 5.2.3

## Project Structure and Key Files

### Root Directory Contents
```
.browserslistrc          - Browser compatibility config
.editorconfig           - Editor settings
.eslintrc.json          - ESLint configuration
.gitignore              - Git ignore rules
.prettierignore         - Prettier ignore rules  
.prettierrc.json        - Prettier formatting config
README.md               - Basic project info
angular.json            - Angular CLI configuration
db.json                 - Mock backend data (json-server)
karma.conf.js           - Karma test runner config
package-lock.json       - Locked dependency versions
package.json            - Project dependencies and scripts
tsconfig.app.json       - TypeScript config for app
tsconfig.json           - Base TypeScript config
tsconfig.spec.json      - TypeScript config for tests
tslint.json             - TSLint config (deprecated)
```

### Important Directories
- **src/**: Angular application source code
- **src/app/**: Main application modules and components
- **src/environments/**: Environment-specific configuration
- **e2e/**: End-to-end tests (Protractor)
- **dist/**: Build output directory

### Mock Backend Data (db.json)
- **Users**: Test user (admin@gmail.com / 12345678)
- **Categories**: Будинок, Їжа, Машина (House, Food, Car)
- **Events**: Sample income/expense transactions
- **Bill**: Account balance (10000 UAH)
- **Rates**: Currency exchange rates (UAH, USD, EUR)

## Technology Stack
- **Framework**: Angular 16.2.2
- **Language**: TypeScript 4.9.3
- **Styling**: Bootstrap 5.2.3, SCSS
- **Charts**: @swimlane/ngx-charts 20.4.1
- **Mock Backend**: json-server 0.17.3
- **Testing**: Karma + Jasmine (broken), Protractor (deprecated)
- **Linting**: ESLint with Angular rules, Prettier
- **Build**: Angular CLI 16.2.16

## Common Issues and Workarounds

### Dependency Installation
- **Issue**: `npm install` fails with peer dependency conflicts
- **Solution**: Always use `npm install --legacy-peer-deps`

### Unit Tests
- **Issue**: Tests fail with "zone-testing.js is needed for the fakeAsync()" error
- **Solution**: Tests are broken in current state. Use manual validation instead.

### External API Calls
- **Issue**: Console shows blocked requests to monobank.ua and GitHub avatars
- **Solution**: Expected behavior due to CORS/network restrictions. App functions normally.

### Browser Compatibility Warnings
- **Issue**: "One or more browsers...will be ignored as ES5 output is not supported"
- **Solution**: Expected warning for Node.js versions in browserslist. Can be ignored.

## Validation Commands Summary

Run these commands in sequence to validate any changes:
```bash
# 1. Install dependencies (if needed)
npm install --legacy-peer-deps

# 2. Lint the code
npm run lint

# 3. Build the application  
npm run build

# 4. Start the application
npm run dev

# 5. Manual testing at http://localhost:4201
# - Login with admin@gmail.com / 12345678
# - Navigate through all sections
# - Test core functionality
```

**CRITICAL**: Always wait for builds and servers to fully start. Set timeouts of 60+ seconds for build commands and 30+ seconds for server startup. NEVER CANCEL long-running operations.