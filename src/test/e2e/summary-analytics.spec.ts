import { test, expect } from '@playwright/test';
import { setupE2ETestRoom } from './utils/e2e-setup';

test.describe('Step 44 — Post-Auction Summary & Analytics E2E', () => {

  test('should protect unauthorized access to summary route', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('ERR_INTERNET_DISCONNECTED') && !text.includes('Failed to load resource') && !text.includes('WebSocket') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Access summary route without auth
    await page.goto('/rooms/00000000-0000-0000-0000-000000000000/summary');

    // 2. Expect middleware auth redirect to login or error state
    await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname.includes('/summary'));
    const isLogin = page.url().includes('/login');

    if (isLogin) {
      const loginHeading = page.locator('h1, h2, form').first();
      await expect(loginHeading).toBeVisible();
    } else {
      const errorHeading = page.locator('h3:has-text("ACCESS RESTRICTED OR ERROR")');
      await expect(errorHeading).toBeVisible();
    }

    // 3. Verify zero console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('should satisfy responsive layout at 320px viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}/summary`);

    const summaryHeading = page.locator('h1, h2, h3').first();
    await expect(summaryHeading).toBeVisible({ timeout: 15000 });

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 320;
    });
    expect(bodyOverflow).toBe(false);
  });
});
