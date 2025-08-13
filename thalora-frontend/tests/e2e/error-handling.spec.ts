import { test, expect } from '@playwright/test';

test.describe('Error Handling and Edge Cases', () => {
  test('should handle backend server unavailable', async ({ page }) => {
    // Mock backend being unavailable
    await page.route('**/auth/register/begin', route => {
      route.abort('failed');
    });
    
    await page.goto('/');
    await page.click('text=Create one');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    
    // Try to register
    await page.click('button:has-text("Create Account with Passkey")');
    
    // Should handle the error gracefully
    await expect(page.getByText(/network|connection|error/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle invalid server responses', async ({ page }) => {
    // Mock invalid JSON response
    await page.route('**/auth/register/begin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response'
      });
    });
    
    await page.goto('/');
    await page.click('text=Create one');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    
    await page.click('button:has-text("Create Account with Passkey")');
    
    // Should handle parsing error
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle session timeout', async ({ page }) => {
    const username = `timeout_${Date.now()}`;
    const email = `timeout_${Date.now()}@example.com`;
    
    // Register and login normally
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Mock session timeout
    await page.route('**/api/shorten', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' })
      });
    });
    
    // Try to shorten URL
    await page.fill('input[placeholder="Enter URL to shorten"]', 'https://www.example.com');
    await page.click('button:has-text("Shorten URL")');
    
    // Should handle authentication error
    await expect(page.getByText('Not authenticated')).toBeVisible();
  });

  test('should handle special characters in URLs', async ({ page }) => {
    const username = `special_${Date.now()}`;
    const email = `special_${Date.now()}@example.com`;
    
    // Setup authenticated user
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Test URL with special characters
    const specialUrl = 'https://www.example.com/test?param=value&other=data#section';
    
    await page.fill('input[placeholder="Enter URL to shorten"]', specialUrl);
    await page.click('button:has-text("Shorten URL")');
    
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.url-display__original-url')).toContainText(specialUrl);
  });

  test('should handle unicode characters in URLs', async ({ page }) => {
    const username = `unicode_${Date.now()}`;
    const email = `unicode_${Date.now()}@example.com`;
    
    // Setup authenticated user
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Test URL with unicode characters
    const unicodeUrl = 'https://www.example.com/测试/página';
    
    await page.fill('input[placeholder="Enter URL to shorten"]', unicodeUrl);
    await page.click('button:has-text("Shorten URL")');
    
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.url-display__original-url')).toContainText(unicodeUrl);
  });

  test('should handle concurrent URL shortening requests', async ({ page }) => {
    const username = `concurrent_${Date.now()}`;
    const email = `concurrent_${Date.now()}@example.com`;
    
    // Setup authenticated user
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Slow down the shorten requests to simulate concurrent behavior
    await page.route('**/api/shorten', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });
    
    // Fill URL and click multiple times quickly
    await page.fill('input[placeholder="Enter URL to shorten"]', 'https://www.example.com/concurrent-test');
    
    // Click button multiple times rapidly
    const shortenButton = page.locator('button:has-text("Shorten URL")');
    await shortenButton.click();
    await shortenButton.click(); // Should be disabled after first click
    await shortenButton.click();
    
    // Should only process one request
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Verify only one URL display is shown
    const urlDisplays = page.locator('.url-display');
    await expect(urlDisplays).toHaveCount(1);
  });

  test('should handle large input values', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Create one');
    
    // Test very long username
    const longUsername = 'a'.repeat(300);
    await page.fill('input[name="username"]', longUsername);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button:has-text("Create Account with Passkey")');
    
    // Should show validation error
    await expect(page.getByText(/Username must be.*255 characters/)).toBeVisible();
    
    // Test very long email
    await page.fill('input[name="username"]', 'validuser');
    const longEmail = 'a'.repeat(300) + '@example.com';
    await page.fill('input[name="email"]', longEmail);
    await page.click('button:has-text("Create Account with Passkey")');
    
    // Should handle gracefully (either show error or process)
    // The exact behavior depends on backend validation
  });

  test('should handle rapid clicks and user interactions', async ({ page }) => {
    await page.goto('/');
    
    // Click rapidly between login and register
    for (let i = 0; i < 5; i++) {
      await page.click('text=Create one');
      await expect(page.getByText('Create Account')).toBeVisible();
      
      await page.click('text=Sign in');
      await expect(page.getByText('Welcome Back')).toBeVisible();
    }
    
    // Form should still be functional
    await page.fill('input[placeholder="Enter your username"]', 'testuser');
    const input = page.locator('input[placeholder="Enter your username"]');
    await expect(input).toHaveValue('testuser');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    const username = `nav_${Date.now()}`;
    const email = `nav_${Date.now()}@example.com`;
    
    // Register user
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Navigate to a different page
    await page.goto('http://localhost:8080/health');
    await expect(page.getByText('OK')).toBeVisible();
    
    // Go back
    await page.goBack();
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
    
    // Should still be logged in
    await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();
    
    // Go forward
    await page.goForward();
    await expect(page.getByText('OK')).toBeVisible();
    
    // Go back again
    await page.goBack();
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
  });

  test('should handle page refresh during operations', async ({ page }) => {
    const username = `refresh_${Date.now()}`;
    const email = `refresh_${Date.now()}@example.com`;
    
    await page.goto('/');
    await page.click('text=Create one');
    
    // Fill form but don't submit
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    
    // Refresh page
    await page.reload();
    
    // Form should be reset
    const usernameInput = page.locator('input[name="username"]');
    const emailInput = page.locator('input[name="email"]');
    
    await expect(usernameInput).toHaveValue('');
    await expect(emailInput).toHaveValue('');
    
    // Should still be on registration page
    await expect(page.getByText('Create Account')).toBeVisible();
  });

  test('should handle invalid redirect URLs', async ({ page }) => {
    // Test direct access to invalid shortened URL
    await page.goto('http://localhost:8080/shortened-url/invalid-id-12345');
    
    // Should show 404 error page or JSON error
    const content = await page.textContent('body');
    expect(content).toMatch(/not found|error|404/i);
  });

  test('should handle malformed requests', async ({ page }) => {
    // Test API endpoints directly with malformed data
    const response = await page.request.post('http://localhost:8080/api/shorten', {
      data: 'invalid json data',
      headers: {
        'content-type': 'application/json'
      }
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});