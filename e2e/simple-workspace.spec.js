import { expect, test } from '@playwright/test';

test('Simple mode opens the separate simple launcher', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Simple mode' }).click();

  await expect(page).toHaveURL(/\/simple$/);
  await expect(page.getByRole('heading', { name: 'Find a tool and get started' })).toBeVisible();
  await expect(page.locator('#simple-essentials-grid > *')).toHaveCount(8);
  await expect(page.getByRole('button', { name: /Random Wheel/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Word Counter/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Choose audience' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit Simple mode' })).toBeVisible();
});

test('the simple layout editor keeps its shortcuts in this browser', async ({ page }) => {
  await page.goto('/simple');
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await page.getByRole('button', { name: 'Remove Currency Converter' }).click();
  await page.getByRole('searchbox', { name: 'Search tools to add' }).fill('word counter');
  await page.getByRole('button', { name: 'Add Word Counter' }).click();
  await page.getByRole('button', { name: 'Move Word Counter earlier' }).click();

  await page.reload();
  const shortcuts = page.locator('#simple-essentials-grid > *');
  await expect(shortcuts).toHaveCount(8);
  await expect(shortcuts.nth(6)).toContainText('Word Counter');
  await expect(page.getByRole('button', { name: /Currency Converter/ })).toHaveCount(0);

  // The reduced navigation must follow the same stored layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(page.locator('#mobile-navigation-drawer button[data-tool="tool-wc"]')).toHaveCount(1);
  await expect(page.locator('#mobile-navigation-drawer button[data-tool="tool-currency"]')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await expect(page.getByRole('button', { name: 'Remove Currency Converter' })).toBeVisible();
});

test('all-tool search keeps advanced tools in the simple shell', async ({ page }) => {
  await page.goto('/simple');
  await page.getByRole('searchbox', { name: 'Search every tool' }).fill('code preview');
  await page.getByRole('button', { name: /VS Code Preview/ }).click();

  await expect(page).toHaveURL(/\/simple\/code-preview$/);
  await expect(page.getByRole('heading', { name: 'VS Code Preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit Simple mode' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Choose audience' })).toHaveCount(0);
});

test('legacy simple addresses redirect and mobile stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home/simple/tool-color');

  await expect(page).toHaveURL(/\/simple\/color$/);
  await expect(page.getByText('Color Code Converter & HSL Selector')).toBeVisible();
  await expect(page.locator('#mobile-audience-switcher')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit Simple mode' })).toBeVisible();
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false);
});

test('brand always returns to the all-tools home', async ({ page }) => {
  await page.goto('/home/developer/code-preview');
  await page.locator('#desktop-brand-logo').click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Small Web Tools!' })).toBeVisible();
});

test('header shortcuts stay complete when the audience changes', async ({ page }) => {
  await page.goto('/home/developer');
  await page.getByRole('button', { name: 'Media', exact: true }).hover();

  await expect(page.getByRole('button', { name: 'Image Metadata' })).toBeVisible();
});
