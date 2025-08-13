import { test, expect, type Page } from '@playwright/test';

// Helper function to register a test user
async function registerTestUser(page: Page, username: string, email: string) {
  await page.goto('/');
  
  // Should be on auth page since not logged in
  await expect(page.getByText('Create Account')).toBeVisible();
  
  // Click create account if we're on login page
  const createLink = page.locator('text=Create one');
  if (await createLink.isVisible()) {
    await createLink.click();
  }
  
  // Fill registration form
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  
  // Submit registration
  await page.click('button:has-text("Create Account with Passkey")');
  
  // In test mode, this should succeed without WebAuthn
  await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
}

// Helper function to login test user
async function loginTestUser(page: Page, username: string) {
  await page.goto('/');
  
  // Should be on auth page
  await expect(page.getByText('Welcome Back')).toBeVisible();
  
  // Fill login form
  await page.fill('input[placeholder="Enter your username"]', username);
  
  // Submit login
  await page.click('button:has-text("Sign in with Passkey")');
  
  // In test mode, this should succeed without WebAuthn
  await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
}

test.describe('Authentication Flow', () => {
  test('should register a new user in test mode', async ({ page }) => {
    const username = `testuser_${Date.now()}`;
    const email = `test_${Date.now()}@example.com`;
    
    await registerTestUser(page, username, email);
    
    // Verify we're logged in
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
    
    // Verify test mode is active
    const response = await page.request.get('http://localhost:8080/test-mode');
    const testModeInfo = await response.json();
    expect(testModeInfo.test_mode).toBe(true);
  });

  test('should login existing user in test mode', async ({ page }) => {
    const username = `logintest_${Date.now()}`;
    const email = `logintest_${Date.now()}@example.com`;
    
    // First register the user
    await registerTestUser(page, username, email);
    
    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.getByText('Welcome Back')).toBeVisible();
    
    // Login again
    await loginTestUser(page, username);
    
    // Verify we're logged in
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
  });

  test('should handle login with non-existent user', async ({ page }) => {
    await page.goto('/');
    
    // Try to login with non-existent user
    await page.fill('input[placeholder="Enter your username"]', 'nonexistentuser');
    await page.click('button:has-text("Sign in with Passkey")');
    
    // Should show error
    await expect(page.getByText('User not found')).toBeVisible();
  });

  test('should handle registration with duplicate username', async ({ page }) => {
    const username = `duplicate_${Date.now()}`;
    const email1 = `first_${Date.now()}@example.com`;
    const email2 = `second_${Date.now()}@example.com`;
    
    // Register first user
    await registerTestUser(page, username, email1);
    
    // Logout
    await page.click('button:has-text("Logout")');
    
    // Try to register with same username
    await page.goto('/');
    const createLink = page.locator('text=Create one');
    if (await createLink.isVisible()) {
      await createLink.click();
    }
    
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email2);
    await page.click('button:has-text("Create Account with Passkey")');
    
    // Should show error
    await expect(page.getByText('Username already exists')).toBeVisible();
  });

  test('should validate form fields', async ({ page }) => {
    await page.goto('/');
    
    // Switch to registration
    const createLink = page.locator('text=Create one');
    if (await createLink.isVisible()) {
      await createLink.click();
    }
    
    // Try to submit empty form
    await page.click('button:has-text("Create Account with Passkey")');
    await expect(page.getByText('Username is required')).toBeVisible();
    
    // Fill only username
    await page.fill('input[name="username"]', 'test');
    await page.click('button:has-text("Create Account with Passkey")');
    await expect(page.getByText('Email is required')).toBeVisible();
    
    // Test invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button:has-text("Create Account with Passkey")');
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });
});