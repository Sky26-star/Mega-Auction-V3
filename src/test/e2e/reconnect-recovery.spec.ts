import { test, expect } from '@playwright/test';
import { setupE2ETestRoom, startE2ETicker } from './utils/e2e-setup';

test.describe('Step 47 — Live Auction Network Reconnect Recovery E2E', () => {

  test('TEST 1: Simulate network offline/online toggle and verify automatic state reconciliation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('ERR_INTERNET_DISCONNECTED') && !text.includes('Failed to load resource') && !text.includes('WebSocket')) {
          consoleErrors.push(text);
        }
      }
    });

    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startAuctionBtn = page.locator('button:has-text("START AUCTION")');
    await expect(startAuctionBtn).toBeVisible({ timeout: 15000 });
    await startAuctionBtn.click();

    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);
    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    await bidBtn.click();
    await expect(page.locator('button:has-text("YOU ARE LEADING")')).toBeVisible({ timeout: 10000 });

    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    await page.context().setOffline(false);
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("YOU ARE LEADING")')).toBeVisible({ timeout: 15000 });

    if (consoleErrors.length > 0) {
      console.log('Ignored console errors during offline toggle:', consoleErrors);
    }
    stopTicker();
  });

  test('TEST 2: Simulate tab visibilitychange (background tab wakeup) state reconciliation', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startAuctionBtn = page.locator('button:has-text("START AUCTION")');
    await expect(startAuctionBtn).toBeVisible({ timeout: 15000 });
    await startAuctionBtn.click();

    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);
    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);

    await expect(page.locator('button:has-text("PLACE BID")')).toBeVisible({ timeout: 15000 });
    stopTicker();
  });

  test('TEST 3: Verify 320px responsive layout after network reconnect', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startAuctionBtn = page.locator('button:has-text("START AUCTION")');
    await expect(startAuctionBtn).toBeVisible({ timeout: 15000 });
    await startAuctionBtn.click();

    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);
    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    await page.context().setOffline(true);
    await page.waitForTimeout(300);
    await page.context().setOffline(false);
    await page.waitForTimeout(300);

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 320;
    });
    expect(bodyOverflow).toBe(false);
    stopTicker();
  });
});
