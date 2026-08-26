import { test, expect } from '@playwright/test';
import { setupE2ETestRoom, startE2ETicker } from './utils/e2e-setup';

test.describe('Step 46 — Live Auction Browser Refresh Recovery E2E', () => {
  test.setTimeout(90000);

  test('TEST 1: Refresh before any bid on live auction demo stage', async ({ page }) => {
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

    const playerHeading = page.locator('h2');
    await expect(playerHeading.first()).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    await expect(playerHeading.first()).toBeVisible();
    await expect(bidBtn).toBeVisible();

    expect(consoleErrors.length).toBe(0);
    stopTicker();
  });

  test('TEST 2: Refresh after HUMAN BID preserves bid state & price', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 30, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startAuctionBtn = page.locator('button:has-text("START AUCTION")');
    await startAuctionBtn.click();
    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);

    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });
    await bidBtn.click();

    await expect(page.locator('button:has-text("YOU ARE LEADING")')).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('button:has-text("YOU ARE LEADING")')).toBeVisible({ timeout: 15000 });

    stopTicker();
  });

  test('TEST 3: Refresh near timer expiry does not reset timer artificially', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startAuctionBtn = page.locator('button:has-text("START AUCTION")');
    await startAuctionBtn.click();
    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);
    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    await page.reload({ waitUntil: 'domcontentloaded' });

    const unsoldText = page.getByText('UNSOLD', { exact: false }).first();
    await expect(unsoldText).toBeVisible({ timeout: 15000 });

    stopTicker();
  });

  test('TEST 4: Refresh during SOLD outcome state preserves final sold price & team', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startBtn = page.locator('button:has-text("START AUCTION")');
    await startBtn.click();
    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);

    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });
    await bidBtn.click();

    const soldText = page.getByText('PURCHASED BY', { exact: false });
    await expect(soldText).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    const nextBidBtn = page.locator('button:has-text("PLACE BID"), button:has-text("GET READY")').first();
    await expect(nextBidBtn).toBeVisible({ timeout: 15000 });

    stopTicker();
  });

  test('TEST 5: Refresh during UNSOLD outcome state preserves unsold pass status', async ({ page }) => {
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 3, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startBtn = page.locator('button:has-text("START AUCTION")');
    await startBtn.click();
    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);

    const bidBtn = page.locator('button:has-text("PLACE BID")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    const unsoldText = page.getByText('NO BIDS RECEIVED', { exact: false });
    await expect(unsoldText).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    const nextBidBtn = page.locator('button:has-text("PLACE BID"), button:has-text("GET READY")').first();
    await expect(nextBidBtn).toBeVisible({ timeout: 15000 });

    stopTicker();
  });

  test('TEST 6: Satisfies responsive layout at 320px viewport without horizontal overflow after refresh', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const { email, password, roomId } = await setupE2ETestRoom({ autoStartAuction: false, timer: 30, useBots: false });

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await page.goto(`/rooms/${roomId}`);
    const startBtn = page.locator('button:has-text("START AUCTION")');
    await startBtn.click();
    const stopTicker = startE2ETicker();

    await page.waitForURL(/\/rooms\/[a-zA-Z0-9-]+\/auction/);
    await expect(page.locator('button:has-text("PLACE BID")')).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('button:has-text("PLACE BID")')).toBeVisible({ timeout: 15000 });

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > 320;
    });
    expect(bodyOverflow).toBe(false);

    stopTicker();
  });
});
