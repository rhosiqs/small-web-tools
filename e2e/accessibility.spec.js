import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Any temporary exception must include { id, rationale, expires, remediation }.
// Moderate findings are CI failures unless an entry here is complete and unexpired.
const TEMPORARY_ACCEPTED_VIOLATIONS = [{
  id: 'heading-order',
  rationale: 'Legacy tool sections use level-three headings beneath the newly normalized level-one page title.',
  expires: '2026-09-30',
  remediation: 'docs/quality-baselines.md#temporary-axe-exceptions',
}];

function expectNoUnacceptedViolations(results) {
  for (const exception of TEMPORARY_ACCEPTED_VIOLATIONS) {
    expect(exception).toEqual(expect.objectContaining({
      id: expect.any(String),
      rationale: expect.any(String),
      expires: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      remediation: expect.any(String),
    }));
    expect(Date.parse(exception.expires)).toBeGreaterThan(Date.now());
  }
  const acceptedIds = new Set(TEMPORARY_ACCEPTED_VIOLATIONS.map(({ id }) => id));
  expect(results.violations.filter(({ id }) => !acceptedIds.has(id))).toEqual([]);
}

test('consent settings page applies changes in place and announces them', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Service Consent', exact: true }).click();
  await expect(page).toHaveURL(/\/home\/consent$/);
  await expect(page.getByRole('heading', { name: 'Service Consent', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const allowButton = page.getByRole('button', { name: /^Allow / }).first();
  const serviceName = (await allowButton.getAttribute('aria-label')).replace(/^Allow /, '');
  await allowButton.click();
  await expect(page.getByText(`${serviceName} is now allowed.`)).toBeAttached();
  await expect(page.getByRole('button', { name: `Revoke ${serviceName}` })).toBeVisible();

  await page.getByRole('button', { name: 'Reset all preferences' }).click();
  await expect(page.getByText('All third-party service preferences were reset.')).toBeAttached();
  await expect(page.getByRole('button', { name: `Allow ${serviceName}` })).toBeVisible();
});

test('brand and folder-selection controls use native button semantics', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Go to home' }).first()).toBeVisible();
  await page.goto('/home/folder-analyzer');
  await expect(page.getByRole('button', { name: 'Select a folder to analyze' })).toBeVisible();
});

test('desktop category shortcuts remain pointer-only redundant navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/home');

  const desktopHeader = page.locator('header');
  const categoryButton = desktopHeader.getByRole('button', { name: 'Media', exact: true });
  await expect(categoryButton).not.toHaveAttribute('aria-haspopup');
  await expect(categoryButton).not.toHaveAttribute('aria-expanded');

  await categoryButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Media', exact: true })).toBeVisible();

  await categoryButton.hover();
  const shortcut = desktopHeader.getByRole('button', { name: 'Image Metadata' });
  await expect(shortcut).toBeVisible();
  await page.mouse.move(1400, 850);
  await expect(shortcut).toHaveCount(0);
  await expect(page.locator('footer').getByRole('button', { name: 'Image Metadata' })).toBeVisible();

  await categoryButton.hover();
  await shortcut.click();
  await expect(page).toHaveURL(/\/home\/imgmeta$/);
});

test('mobile navigation has a complete focus and dismissal lifecycle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');

  const opener = page.getByRole('button', { name: 'Toggle sidebar' });
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(opener).toHaveAttribute('aria-controls', 'mobile-navigation-drawer');
  await expect(page.getByRole('dialog', { name: 'Tool navigation' })).toHaveCount(0);

  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Tool navigation' });
  const closeButton = page.getByRole('button', { name: 'Close navigation' });
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(page.locator('main')).toHaveJSProperty('inert', true);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  const openDrawerAxe = await new AxeBuilder({ page }).analyze();
  expectNoUnacceptedViolations(openDrawerAxe);

  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: 'Toggle dark/light mode' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(opener).toBeFocused();

  await opener.click();
  await drawer.getByRole('button', { name: 'Word Counter' }).click();
  await expect(page).toHaveURL(/\/home\/wc$/);
  await expect(drawer).toHaveCount(0);

  await opener.click();
  await page.locator('#mobile-drawer-overlay').click({ position: { x: 350, y: 400 } });
  await expect(drawer).toHaveCount(0);
});

for (const route of [
  '/home', '/simple', '/simple/color', '/home/currency', '/home/folder-analyzer',
  '/home/about', '/home/privacy', '/home/consent', '/home/terms', '/home/security', '/home/license',
]) {
  test(`${route} has no unaccepted automated accessibility findings`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expectNoUnacceptedViolations(results);
  });
}
