import { test, expect, type Page } from '@playwright/test';

// Helper function to setup authenticated user
async function setupAuthenticatedUser(page: Page) {
  const username = `urltest_${Date.now()}`;
  const email = `urltest_${Date.now()}@example.com`;
  
  await page.goto('/');
  
  // Register new user
  const createLink = page.locator('text=Create one');
  if (await createLink.isVisible()) {
    await createLink.click();
  }
  
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Create Account with Passkey")');
  
  // Wait for successful login
  await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
  
  return { username, email };
}

test.describe('URL Shortening', () => {
  test('should create a shortened URL', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    const testUrl = 'https://www.example.com/test-page';
    
    // Fill URL form
    await page.fill('input[placeholder="Enter URL to shorten"]', testUrl);
    await page.click('button:has-text("Shorten URL")');
    
    // Wait for shortened URL to appear
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Verify the shortened URL is displayed
    const shortenedUrl = page.locator('.url-display__short-url');
    await expect(shortenedUrl).toBeVisible();
    
    // Verify it starts with localhost:8080 (since we're in test mode)
    const urlText = await shortenedUrl.textContent();
    expect(urlText).toContain('localhost:8080/shortened-url/');
    
    // Verify original URL is displayed
    await expect(page.locator('.url-display__original-url')).toContainText(testUrl);
  });

  test('should copy shortened URL to clipboard', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    const testUrl = 'https://www.example.com/copy-test';
    
    // Create shortened URL
    await page.fill('input[placeholder="Enter URL to shorten"]', testUrl);
    await page.click('button:has-text("Shorten URL")');
    
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Click copy button
    await page.click('button:has-text("Copy")');
    
    // Verify copy success message
    await expect(page.getByText('Copied!')).toBeVisible();
    
    // In a real test environment, we would verify clipboard content
    // but that requires special permissions in headless mode
  });

  test('should test shortened URL redirect', async ({ page, context }) => {
    await setupAuthenticatedUser(page);
    
    const testUrl = 'https://www.example.com/redirect-test';
    
    // Create shortened URL
    await page.fill('input[placeholder="Enter URL to shorten"]', testUrl);
    await page.click('button:has-text("Shorten URL")');
    
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Get the shortened URL
    const shortenedUrl = await page.locator('.url-display__short-url').textContent();
    expect(shortenedUrl).toBeTruthy();
    
    // Click the "Test Link" button
    const testButton = page.locator('button:has-text("Test Link")');
    await expect(testButton).toBeVisible();
    
    // Listen for new page/tab opening
    const newPagePromise = context.waitForEvent('page');
    await testButton.click();
    
    const newPage = await newPagePromise;
    
    // Wait for redirect (the new page should ultimately redirect to the original URL)
    // Since we can't control external URLs in tests, we'll verify the redirect response
    const response = await newPage.waitForResponse(response => 
      response.url().includes('/shortened-url/') && response.status() === 302
    );
    
    expect(response.status()).toBe(302);
    
    // Verify Location header
    const location = response.headers().location;
    expect(location).toBe(testUrl);
    
    await newPage.close();
  });

  test('should handle invalid URLs', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Test empty URL
    await page.click('button:has-text("Shorten URL")');
    await expect(page.getByText('URL cannot be empty')).toBeVisible();
    
    // Test invalid URL format
    await page.fill('input[placeholder="Enter URL to shorten"]', 'invalid-url');
    await page.click('button:has-text("Shorten URL")');
    await expect(page.getByText('Invalid URL format')).toBeVisible();
    
    // Test HTTP URL (should require HTTPS)
    await page.fill('input[placeholder="Enter URL to shorten"]', 'http://example.com');
    await page.click('button:has-text("Shorten URL")');
    await expect(page.getByText('Only HTTPS URLs are supported')).toBeVisible();
  });

  test('should create multiple URLs', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    const urls = [
      'https://www.example.com/page1',
      'https://www.example.com/page2',
      'https://www.example.com/page3'
    ];
    
    for (let i = 0; i < urls.length; i++) {
      // Create shortened URL
      await page.fill('input[placeholder="Enter URL to shorten"]', urls[i]);
      await page.click('button:has-text("Shorten URL")');
      
      await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
      
      // Verify URL is displayed
      await expect(page.locator('.url-display__original-url')).toContainText(urls[i]);
      
      // Clear form for next URL (if not the last one)
      if (i < urls.length - 1) {
        await page.locator('input[placeholder="Enter URL to shorten"]').clear();
      }
    }
  });

  test('should handle very long URLs', async ({ page }) => {
    await setupAuthenticatedUser(page);
    
    // Create a very long URL
    const baseUrl = 'https://www.example.com/';
    const longPath = 'very-long-path-'.repeat(100);
    const longUrl = baseUrl + longPath;
    
    await page.fill('input[placeholder="Enter URL to shorten"]', longUrl);
    await page.click('button:has-text("Shorten URL")');
    
    // Should still work
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.url-display__original-url')).toContainText(baseUrl);
  });
});

test.describe('URL Shortening - Error Cases', () => {
  test('should handle non-existent shortened URL', async ({ page }) => {
    // Try to access a non-existent shortened URL directly
    const response = await page.request.get('http://localhost:8080/shortened-url/nonexistent');
    expect(response.status()).toBe(404);
    
    const errorBody = await response.json();
    expect(errorBody.error).toBe('Short URL not found');
  });

  test('should handle malformed shortened URL ID', async ({ page }) => {
    // Try to access with malformed ID
    const response = await page.request.get('http://localhost:8080/shortened-url/');
    expect(response.status()).toBe(404); // Should be handled by routing
  });
});