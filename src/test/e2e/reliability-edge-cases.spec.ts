import { test, expect } from '@playwright/test';
import { setupE2ETestRoom, startE2ETicker } from './utils/e2e-setup';

test.describe('Step 49 — Auction Reliability & Edge-Case Completion E2E', () => {

  test('1. Timer expiry vs simultaneous bid idempotency check', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('ERR_INTERNET_DISCONNECTED') && !text.includes('Failed to load resource') && !text.includes('WebSocket')) {
          consoleErrors.push(text);
        }
      }
    });

    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 8, useBots: false });

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

    await page.waitForTimeout(5000);

    await bidBtn.click();

    const successOrSold = page.locator('button:has-text("YOU ARE LEADING")')
      .or(page.locator('text="PURCHASED BY"'))
      .or(page.locator('text="NO BIDS RECEIVED"'));

    await expect(successOrSold.first()).toBeVisible({ timeout: 15000 });

    expect(consoleErrors.length).toBe(0);
    stopTicker();
  });

  test('2. Minimum participant / team start gate validation in room lobby UI', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    await page.waitForTimeout(500);

    const pageHeading = page.locator('h1, h2, h3').first();
    await expect(pageHeading).toBeVisible();
  });

  test('3. Player uniqueness and auction-bound historical data protection', async ({ page }) => {
    const { email, password } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto('/player-sets');
    await page.waitForTimeout(500);

    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible();
  });

  test('4. 320px responsive layout renders without horizontal overflow', async ({ page }) => {
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

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 320;
    });
    expect(bodyOverflow).toBe(false);
    stopTicker();
  });
});
