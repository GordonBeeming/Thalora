import { test, expect, type Page } from '@playwright/test';

test.describe('Complete User Workflow', () => {
  test('should complete full user journey', async ({ page, context }) => {
    const username = `fulltest_${Date.now()}`;
    const email = `fulltest_${Date.now()}@example.com`;
    const testUrls = [
      'https://www.google.com',
      'https://www.github.com',
      'https://www.stackoverflow.com'
    ];

    // Step 1: Initial page load (should show auth page)
    await page.goto('/');
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Step 2: Navigate to registration
    await page.click('text=Create one');
    await expect(page.getByText('Create Account')).toBeVisible();

    // Step 3: Complete registration
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');

    // Step 4: Verify successful registration and login
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();

    // Step 5: Create multiple shortened URLs
    const shortenedUrls = [];
    
    for (const url of testUrls) {
      await page.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', url);
      await page.click('button:has-text("Shorten URL")');
      
      await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
      
      // Get the shortened URL
      const shortenedUrl = await page.locator('.url-display__short-url').textContent();
      expect(shortenedUrl).toBeTruthy();
      shortenedUrls.push(shortenedUrl!);
      
      // Verify original URL is correct
      await expect(page.locator('.url-display__original-url')).toContainText(url);
      
      // Test the copy functionality
      await page.click('button:has-text("Copy")');
      await expect(page.getByText('Copied!')).toBeVisible();
      
      // Clear input for next URL
      if (url !== testUrls[testUrls.length - 1]) {
        await page.locator('input[placeholder="Enter your URL here (e.g., google.com)"]').clear();
      }
    }

    // Step 6: Test each shortened URL redirect
    for (let i = 0; i < shortenedUrls.length; i++) {
      const shortenedUrl = shortenedUrls[i];
      const originalUrl = testUrls[i];
      
      // Extract the short ID from the URL
      const shortId = shortenedUrl.split('/').pop();
      expect(shortId).toBeTruthy();
      
      // Test redirect directly via API
      const response = await page.request.get(`http://localhost:8080/shortened-url/${shortId}`, {
        maxRedirects: 0 // Don't follow redirects automatically
      });
      
      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe(originalUrl);
    }

    // Step 7: Test the "Test Link" button functionality
    // Go to first URL display (should still be visible)
    await page.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', testUrls[0]);
    await page.click('button:has-text("Shorten URL")');
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    const testLinkButton = page.locator('button:has-text("Test Link")');
    await expect(testLinkButton).toBeVisible();
    
    // Click test link and verify new tab opens
    const newPagePromise = context.waitForEvent('page');
    await testLinkButton.click();
    const newPage = await newPagePromise;
    
    // Verify the new page has the correct properties
    expect(newPage.url()).toContain('/shortened-url/');
    
    // Wait for redirect response
    const redirectResponse = await newPage.waitForResponse(response => 
      response.status() === 302 && response.url().includes('/shortened-url/')
    );
    
    expect(redirectResponse.status()).toBe(302);
    expect(redirectResponse.headers().location).toBe(testUrls[0]);
    
    await newPage.close();

    // Step 8: Test logout
    await page.click('button:has-text("Logout")');
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Step 9: Test login with existing account
    await page.fill('input[placeholder="Enter your username"]', username);
    await page.click('button:has-text("Sign in with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();

    // Step 10: Verify we can still create URLs after re-login
    const postLoginUrl = 'https://www.example.com/post-login-test';
    await page.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', postLoginUrl);
    await page.click('button:has-text("Shorten URL")');
    
    await expect(page.locator('.url-display')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.url-display__original-url')).toContainText(postLoginUrl);
  });

  test('should handle session persistence', async ({ page }) => {
    const username = `session_${Date.now()}`;
    const email = `session_${Date.now()}@example.com`;
    
    // Register and login
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Reload the page - should stay logged in
    await page.reload();
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
    await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();
    
    // Navigate away and back
    await page.goto('http://localhost:8080/health');
    await page.goto('http://localhost:3000');
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible();
  });

  test('should handle multiple browser tabs', async ({ context }) => {
    const username = `multitab_${Date.now()}`;
    const email = `multitab_${Date.now()}@example.com`;
    
    // Create first tab and login
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.click('text=Create one');
    await page1.fill('input[name="username"]', username);
    await page1.fill('input[name="email"]', email);
    await page1.click('button:has-text("Create Account with Passkey")');
    
    await expect(page1.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Create second tab - should also be logged in
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.getByText('Secure URL shortening with passkey')).toBeVisible();
    
    // Create URL in first tab
    await page1.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', 'https://www.example.com/tab1');
    await page1.click('button:has-text("Shorten URL")');
    await expect(page1.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Create URL in second tab
    await page2.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', 'https://www.example.com/tab2');
    await page2.click('button:has-text("Shorten URL")');
    await expect(page2.locator('.url-display')).toBeVisible({ timeout: 10000 });
    
    // Logout from first tab
    await page1.click('button:has-text("Logout")');
    await expect(page1.getByText('Welcome Back')).toBeVisible();
    
    // Second tab should also be logged out after reload
    await page2.reload();
    await expect(page2.getByText('Welcome Back')).toBeVisible();
    
    await page1.close();
    await page2.close();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const username = `network_${Date.now()}`;
    const email = `network_${Date.now()}@example.com`;
    
    // Register and login normally
    await page.goto('/');
    await page.click('text=Create one');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.click('button:has-text("Create Account with Passkey")');
    
    await expect(page.getByText('Secure URL shortening with passkey')).toBeVisible({ timeout: 10000 });
    
    // Simulate network failure by intercepting requests
    await page.route('**/api/shorten', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Network error' })
      });
    });
    
    // Try to shorten URL - should show error
    await page.fill('input[placeholder="Enter your URL here (e.g., google.com)"]', 'https://www.example.com/error-test');
    await page.click('button:has-text("Shorten URL")');
    
    // Should show error message
    await expect(page.getByText('Network error')).toBeVisible();
  });
});