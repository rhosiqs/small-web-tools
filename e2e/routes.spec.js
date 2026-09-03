import { expect, test } from '@playwright/test';
import { PUBLIC_ROUTE_IDS } from '../src/toolRegistry.js';

const toolRoutes = PUBLIC_ROUTE_IDS;
const routePath = (route) => (
  route === 'tool-home' ? '/home' : `/home/${route.replace(/^tool-/, '')}`
);

async function blockExternalRequests(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      return route.continue();
    }
    return route.abort();
  });
}

for (const route of toolRoutes) {
  test(`${route} renders without an uncaught error`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await blockExternalRequests(page);
    await page.goto(routePath(route), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    // A slug the path parser cannot resolve is normalized back to the dashboard.
    if (route !== 'tool-home') await expect(page).not.toHaveURL(/\/home$/);
    await expect(page.locator('text=Failed to load component')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('unknown path is normalized to the dashboard', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/home/does-not-exist', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/does-not-exist/);
  await expect(page.locator('main')).toBeVisible();
});

test('desktop search input reserves space for its leading icon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await blockExternalRequests(page);
  await page.goto('/home', { waitUntil: 'domcontentloaded' });

  const searchInput = page.locator('.header-search-input');
  await expect(searchInput).toBeVisible();

  const spacing = await searchInput.evaluate((input) => {
    const icon = input.previousElementSibling;
    const inputBox = input.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return {
      iconRight: iconBox.right - inputBox.left,
      paddingLeft: Number.parseFloat(getComputedStyle(input).paddingLeft),
    };
  });

  expect(spacing.paddingLeft).toBeGreaterThanOrEqual(spacing.iconRight + 4);
});

test('mobile header, breadcrumb, and tool content do not overlap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await blockExternalRequests(page);
  await page.goto('/home/iplookup', { waitUntil: 'domcontentloaded' });

  const banner = page.locator('#channel-alert-banner');
  const header = page.locator('#mobile-header');
  const breadcrumb = page.locator('#mobile-breadcrumb');
  const toolCard = page.locator('#tool-iplookup');

  await expect(header).toBeVisible();
  await expect(breadcrumb).toBeVisible();
  await expect(toolCard).toBeVisible();

  const bannerBox = await banner.isVisible() ? await banner.boundingBox() : null;
  const headerBox = await header.boundingBox();
  const breadcrumbBox = await breadcrumb.boundingBox();
  const toolCardBox = await toolCard.boundingBox();

  expect(headerBox).not.toBeNull();
  expect(breadcrumbBox).not.toBeNull();
  expect(toolCardBox).not.toBeNull();

  const headerBottom = headerBox.y + headerBox.height;
  const breadcrumbBottom = breadcrumbBox.y + breadcrumbBox.height;

  if (bannerBox) {
    expect(headerBox.y).toBeGreaterThanOrEqual(bannerBox.y + bannerBox.height - 1);
  } else {
    expect(headerBox.y).toBeLessThanOrEqual(1);
  }
  expect(breadcrumbBox.y).toBeGreaterThanOrEqual(headerBottom - 1);
  expect(breadcrumbBox.y - headerBottom).toBeLessThanOrEqual(1);
  expect(toolCardBox.y).toBeGreaterThanOrEqual(breadcrumbBottom - 1);
});
