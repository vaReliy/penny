# Penny - Personal Finance Management Application

Penny (Пенні) is an Angular 16.2.2 educational project implementing a personal finance/home accounting application with a Ukrainian interface. The application includes user authentication, expense tracking, category management, and multi-currency support.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Initial Setup and Dependencies
- **CRITICAL**: Install dependencies using: `npm install --legacy-peer-deps` or `npm install --force`
  - Standard `npm install` will fail due to dependency conflicts with deprecated tslint/codelyzer packages
  - Installation takes 60-90 seconds. NEVER CANCEL. Set timeout to 3+ minutes.
- The project has 19 known security vulnerabilities (6 low, 11 moderate, 2 critical) from old dependencies - this is expected for an educational project

### Building the Application
- **Development build**: `npm run build`
  - Takes ~20 seconds. Set timeout to 2+ minutes.
  - Produces ~4 MB bundle in `dist/penny/` directory
- **Production build**: `npm run prod`  
  - Takes ~25 seconds. Set timeout to 2+ minutes.
  - Produces optimized ~839 KB bundle (~176 KB gzipped)

### Running the Application
- **Development mode**: `npm run dev`
  - Starts json-server (mock backend) on port 3201 AND Angular dev server on port 4201 concurrently
  - Takes ~20 seconds to start both servers. Set timeout to 2+ minutes.
  - Application will be available at http://localhost:4201
- **Frontend only**: `npm run start` (Angular dev server only on port 4201)
- **Backend only**: `npm run server` (json-server only on port 3201)

### Testing and Quality Checks
- **Unit tests**: `npm run test -- --watch=false --browsers=ChromeHeadless`
  - Takes ~16 seconds. Set timeout to 2+ minutes.
  - **NOTE**: Tests currently fail due to zone.js configuration issues - this is a known limitation
- **Linting**: `npm run lint`
  - Takes ~3 seconds. Always run before committing.
  - Produces 5 warnings about TypeScript `any` types - this is acceptable
- **E2E tests**: `npm run e2e`
  - **FAILS in restricted environments** due to inability to download chromedriver
  - Uses deprecated Protractor (end-of-life) - avoid if possible

## Manual Validation Scenarios

### Essential Login Flow Testing
**ALWAYS test the login functionality after making authentication-related changes:**
1. Navigate to http://localhost:4201 (will redirect to /login)
2. Use test credentials: `admin@gmail.com` / `12345678`
3. Verify redirect to `/system/bill` dashboard after successful login
4. Check that navigation menu shows: Рахунок, Історія, Планувальник, Записи

### Application Features Testing
**Test key functionality by navigating through these sections:**
- **Рахунок (Account/Bill)**: View account balance, currency rates, spending overview
- **Записи (Records)**: Add financial events, manage categories, edit spending limits
  - Test adding income/expense events
  - Test creating new spending categories
  - Verify category dropdown population
- **Історія (History)**: Transaction history and reports
- **Планувальник (Planner)**: Budget planning features

### API Verification
**Verify mock backend is working:**
- Check json-server endpoints are accessible:
  - http://localhost:3201/users
  - http://localhost:3201/categories  
  - http://localhost:3201/events
- Ensure `db.json` data is loading correctly

## Project Structure and Navigation

### Key Directories
```
src/app/
├── auth/           # Login and registration modules
├── shared/         # Common components, services, guards, models
├── system/         # Main application features
│   ├── page-bill/      # Account overview page
│   ├── page-history/   # Transaction history
│   ├── page-planner/   # Budget planner
│   └── page-records/   # Event and category management
└── app-routing.module.ts
```

### Important Files
- `db.json` - Mock backend data (users, categories, events, exchange rates)
- `package.json` - Contains all npm scripts and dependencies
- `angular.json` - Angular CLI build configuration
- `.eslintrc.json` - ESLint configuration (extends Prettier)
- `tsconfig.json` - TypeScript compiler configuration

## Common Development Tasks

### Making Changes to Authentication
- Edit files in `src/app/auth/`
- Test with provided credentials: admin@gmail.com / 12345678
- Always verify login flow works after auth changes

### Adding New Features
- Follow existing module structure in `src/app/system/`
- Use lazy loading for new feature modules
- Update routing in respective `-routing.module.ts` files

### Working with Financial Data
- Categories are in Ukrainian: Будинок (House), Їжа (Food), Машина (Car)
- Events support income (Прибуток) and expense (Витрата) types
- Multi-currency support: UAH (default), USD, EUR

### Styling and UI
- Uses Bootstrap 5.2.3 with custom SCSS
- Components use OnPush change detection strategy
- Responsive design with Ukrainian language interface

## Troubleshooting

### Build Failures
- If build fails with module resolution errors, try: `rm -rf node_modules package-lock.json && npm install --force`
- Ensure Node.js version compatibility (tested with v20.19.5)

### Development Server Issues
- If ports 3201 or 4201 are in use, the servers will fail to start
- Check both json-server and Angular dev server logs in concurrent output

### Test Failures
- Unit tests currently have zone.js configuration issues - this is expected
- Focus on manual browser testing for validation
- E2E tests require internet access and won't work in restricted environments

## Performance Notes
- Development bundle is large (~4.5 MB) due to unoptimized build
- Production build is significantly smaller (~839 KB)
- Application startup is fast (~17-20 seconds for complete dev environment)
- All build and test commands complete within 30 seconds

## Code Quality
- Project uses ESLint with Prettier for code formatting
- TypeScript strict mode is not fully enabled (allows `any` types)
- ~2,900 lines of code total across TypeScript, HTML, and SCSS files
- Educational project quality - some best practices may not be followed