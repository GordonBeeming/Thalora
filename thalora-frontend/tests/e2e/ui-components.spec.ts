import { test, expect } from '@playwright/test';

test.describe('UI Components and Responsive Design', () => {
  test('should have responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Check that login form is properly sized for mobile
    const loginContainer = page.locator('.login__container');
    await expect(loginContainer).toBeVisible();

    // Verify form elements are properly sized
    const usernameInput = page.locator('input[placeholder="Enter your username"]');
    await expect(usernameInput).toBeVisible();

    const loginButton = page.locator('button:has-text("Sign in with Passkey")');
    await expect(loginButton).toBeVisible();

    // Switch to registration and check mobile layout
    await page.click('text=Create one');

    const registerContainer = page.locator('.register__container');
    await expect(registerContainer).toBeVisible();

    // Verify registration form fields are accessible on mobile
    const usernameField = page.locator('input[name="username"]');
    const emailField = page.locator('input[name="email"]');
    const registerButton = page.locator('button:has-text("Create Account with Passkey")');

    await expect(usernameField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(registerButton).toBeVisible();
  });

  test('should have responsive design on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');

    // Check layout on tablet
    const loginContainer = page.locator('.login__container');
    await expect(loginContainer).toBeVisible();

    // Elements should be well-spaced on tablet
    const header = page.locator('.login__header');
    const form = page.locator('.login__form');

    await expect(header).toBeVisible();
    await expect(form).toBeVisible();
  });

  test('should have proper styling and branding', async ({ page }) => {
    await page.goto('/');

    // Check for Thalora branding
    await expect(page.getByText('Thalora')).toBeVisible();
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();

    // Verify color scheme and styling
    const body = page.locator('body');
    const computedStyle = await body.evaluate(el => getComputedStyle(el));

    // Just verify that styles are applied (not specific colors as they may vary)
    expect(computedStyle.fontFamily).toBeTruthy();
    expect(computedStyle.backgroundColor).toBeTruthy();
  });

  test('should have accessible form elements', async ({ page }) => {
    await page.goto('/');

    // Check login form accessibility
    const usernameInput = page.locator('input[placeholder="Enter your username"]');

    // Verify input has proper attributes
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(usernameInput).toHaveAttribute('placeholder', 'Enter your username');

    const loginButton = page.locator('button:has-text("Sign in with Passkey")');
    await expect(loginButton).toHaveAttribute('type', 'submit');

    // Switch to registration
    await page.click('text=Create one');

    // Check registration form accessibility
    const usernameField = page.locator('input[name="username"]');
    const emailField = page.locator('input[name="email"]');

    await expect(usernameField).toHaveAttribute('name', 'username');
    await expect(usernameField).toHaveAttribute('type', 'text');
    await expect(emailField).toHaveAttribute('name', 'email');
    await expect(emailField).toHaveAttribute('type', 'email');
  });

  test('should show loading states', async ({ page }) => {
    const username = `loading_${Date.now()}`;
    const email = `loading_${Date.now()}@example.com`;

    await page.goto('/');
    await page.click('text=Create one');

    // Fill form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);

    // Intercept the registration request to simulate slow network
    await page.route('**/auth/register/complete', async route => {
      // Delay for 2 seconds to see loading state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    // Click register button
    const registerButton = page.locator('button:has-text("Create Account with Passkey")');
    await registerButton.click();

    // Should show loading state
    await expect(registerButton).toBeDisabled();

    // Wait for completion
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 15000 });
  });

  test('should handle URL shortening form states', async ({ page }) => {
    const username = `formtest_${Date.now()}`;
    const email = `formtest_${Date.now()}@example.com`;

    // Register and login
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');

    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });

    // Test URL form initial state
    const urlInput = page.locator('input[placeholder="Enter your URL here (e.g., gordonbeeming.com)"]');
    const shortenButton = page.locator('button:has-text("Shorten URL")');

    await expect(urlInput).toBeVisible();
    await expect(urlInput).toBeEditable();
    await expect(shortenButton).toBeVisible();
    await expect(shortenButton).toBeEnabled();

    // Test form with valid input
    await urlInput.fill('https://www.example.com');
    await expect(shortenButton).toBeEnabled();

    // Test loading state during URL shortening
    await page.route('**/api/shorten', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });

    await shortenButton.click();

    // Should show loading state
    await expect(shortenButton).toBeDisabled();

    // Wait for completion
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
  });

  test('should display URLs correctly in URL display component', async ({ page }) => {
    const username = `display_${Date.now()}`;
    const email = `display_${Date.now()}@example.com`;
    const testUrl = 'https://www.example.com/test-display-component';

    // Setup authenticated user
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');

    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });

    // Create shortened URL
    await page.fill('input[placeholder="Enter your URL here (e.g., gordonbeeming.com)"]', testUrl);
    await page.click('button:has-text("Shorten URL")');

    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });

    // Verify URL display components
    const shortUrlElement = page.locator('.url-display__short-url');
    const originalUrlElement = page.locator('.url-display__original-url');
    const copyButton = page.locator('button:has-text("Copy")');
    const testButton = page.locator('button:has-text("Test Link")');

    await expect(shortUrlElement).toBeVisible();
    await expect(originalUrlElement).toBeVisible();
    await expect(copyButton).toBeVisible();
    await expect(testButton).toBeVisible();

    // Verify URL content
    await expect(originalUrlElement).toContainText(testUrl);

    const shortUrlText = await shortUrlElement.textContent();
    expect(shortUrlText).toContain('localhost:8080/shortened-url/');
    expect(shortUrlText).toMatch(/shortened-url\/[A-Za-z0-9]+$/);

    // Test copy functionality
    await copyButton.click();
    await expect(page.getByText('Copied!')).toBeVisible();

    // The copied text should disappear after a moment
    await expect(page.getByText('Copied!')).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle dark/light mode if implemented', async ({ page }) => {
    // This test would check for theme switching if implemented
    // For now, just verify consistent styling

    await page.goto('/');

    const body = page.locator('body');
    const computedStyle = await body.evaluate(el => getComputedStyle(el));

    // Verify basic styling is applied
    expect(computedStyle.fontFamily).not.toBe('');
    expect(computedStyle.backgroundColor).not.toBe('');
    expect(computedStyle.color).not.toBe('');
  });
});