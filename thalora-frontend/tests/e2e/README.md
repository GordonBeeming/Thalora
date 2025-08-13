# End-to-End Testing with Playwright

This directory contains comprehensive end-to-end tests for the Thalora URL shortener using Playwright.

## Features Tested

### Authentication (Test Mode)
- User registration with test mode bypass
- User login with test mode bypass  
- Session persistence and management
- Error handling for invalid credentials
- Form validation

### URL Shortening
- Creating shortened URLs
- URL validation and error handling
- Copy to clipboard functionality
- "Test Link" button functionality
- Redirect verification
- Multiple URL management

### UI Components
- Responsive design (mobile, tablet, desktop)
- Form states and loading indicators
- Error message display
- Component interactions
- Accessibility features

### Complete User Workflows
- Full registration → login → URL creation → testing flow
- Session management across browser tabs
- Navigation and browser history
- Network error handling

## Test Mode Implementation

The tests use a special **test mode** to bypass WebAuthn/passkey authentication:

### Backend Test Mode
- Enabled via `TEST_MODE=true` environment variable
- Bypasses actual WebAuthn credential validation
- Uses fake passkey data for authentication
- Maintains same API contract but skips cryptographic validation

### Frontend Test Mode
- Automatically detects test mode from backend
- Skips WebAuthn API calls
- Uses simplified credential objects
- Maintains same UI flow

## Running Tests

### Prerequisites
```bash
# Install dependencies
cd thalora-frontend
pnpm install

# Install Playwright browsers
npx playwright install
```

### Local Development
```bash
# Run all tests
pnpm run test:e2e

# Run tests with UI
pnpm run test:e2e:ui

# Run tests in headed mode (see browser)
pnpm run test:e2e:headed
```

### Using Docker
```bash
# Run complete test environment
pnpm run test:setup
```

### Manual Setup
1. **Start SQL Server:**
   ```bash
   docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=YourTestPassword123!' \
     -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
   ```

2. **Start Backend in Test Mode:**
   ```bash
   cd backend
   TEST_MODE=true SKIP_DOMAIN_VERIFICATION=true cargo run
   ```

3. **Start Frontend:**
   ```bash
   cd thalora-frontend
   pnpm start
   ```

4. **Run Tests:**
   ```bash
   npx playwright test
   ```

## Test Structure

### Test Files
- `auth.spec.ts` - Authentication flow tests
- `url-shortening.spec.ts` - URL shortening functionality
- `workflow.spec.ts` - Complete user workflow tests
- `ui-components.spec.ts` - UI and responsive design tests
- `error-handling.spec.ts` - Error scenarios and edge cases

### Configuration
- `playwright.config.ts` - Playwright configuration
- `global-setup.ts` - Test environment setup
- `global-teardown.ts` - Test environment cleanup

## Environment Variables

### Required for Testing
```bash
TEST_MODE=true                    # Enable test mode
SKIP_DOMAIN_VERIFICATION=true     # Skip domain verification
DATABASE_URL=Server=localhost...  # Test database connection
```

### Optional
```bash
PLAYWRIGHT_BROWSERS_PATH=/path    # Custom browser installation path
CI=true                          # Enable CI-specific behavior
```

## Test Scenarios Covered

### Happy Path
✅ User registration and login  
✅ URL shortening and management  
✅ Redirect functionality  
✅ Copy to clipboard  
✅ Session persistence  

### Error Handling
✅ Invalid URLs and validation  
✅ Network failures  
✅ Authentication errors  
✅ Session timeout  
✅ Server errors  

### UI/UX
✅ Responsive design  
✅ Loading states  
✅ Form validation  
✅ Accessibility  
✅ Cross-browser compatibility  

### Edge Cases
✅ Special characters in URLs  
✅ Unicode support  
✅ Concurrent requests  
✅ Large input values  
✅ Browser navigation  

## Continuous Integration

Tests run automatically on:
- Pull requests to `main` and `develop`
- Pushes to `main`, `develop`, and `copilot/*` branches

See `.github/workflows/e2e-tests.yml` for CI configuration.

## Debugging Tests

### View Test Results
```bash
# Open HTML report
npx playwright show-report
```

### Debug Mode
```bash
# Run specific test in debug mode
npx playwright test --debug auth.spec.ts
```

### Screenshots and Videos
- Screenshots taken on failure
- Videos recorded for failed tests
- Traces available for debugging

## Best Practices

### Writing Tests
- Use descriptive test names
- Include setup and teardown
- Test realistic user scenarios
- Handle async operations properly
- Use data-testid attributes for stable selectors

### Test Data
- Generate unique test data (timestamps)
- Clean up test data when needed  
- Use test-specific databases
- Avoid hardcoded values

### Maintenance
- Keep tests independent
- Update selectors when UI changes
- Monitor test performance
- Review and update test scenarios regularly

## Common Issues

### Browser Installation
If browsers fail to install:
```bash
npx playwright install --with-deps
```

### Test Timeouts
Increase timeouts in `playwright.config.ts` if needed:
```typescript
use: {
  timeout: 30000, // 30 seconds
}
```

### Database Connection
Ensure SQL Server is running and accessible:
```bash
docker ps | grep sqlserver
```

### Port Conflicts
Check for port conflicts if services fail to start:
```bash
lsof -i :3000  # Frontend
lsof -i :8080  # Backend
lsof -i :1433  # SQL Server
```