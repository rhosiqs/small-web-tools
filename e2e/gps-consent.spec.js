import { expect, test } from '@playwright/test';

test('IP coordinates do not contact OpenStreetMap before consent and reset removes the map', async ({ page }) => {
  const osmRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('openstreetmap.org')) osmRequests.push(request.url());
  });
  await page.route('**/api/iplookup**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      data: {
        ip: '203.0.113.1',
        city: 'Example',
        country_name: 'Exampleland',
        latitude: 25.033,
        longitude: 121.5654,
      },
    }),
  }));
  await page.route('https://www.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<html></html>',
  }));

  await page.goto('/home/iplookup');
  await page.getByRole('button', { name: 'Allow IP lookup' }).click();
  await page.getByRole('button', { name: 'Lookup', exact: true }).click();
  await expect(page.getByText('25.033, 121.5654')).toBeVisible();
  expect(osmRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Enable OpenStreetMap Preview' }).click();
  await expect(page.getByTitle('IP Location on OpenStreetMap')).toBeVisible();
  await expect.poll(() => osmRequests.length).toBeGreaterThan(0);

  // Consent settings are their own page, so a reset reaches a mounted tool through
  // the consent_updated event rather than from a dialog above it.
  await page.evaluate(() => {
    window.localStorage.removeItem('small_web_tools_consent');
    window.dispatchEvent(new Event('consent_updated'));
  });
  await expect(page.getByTitle('IP Location on OpenStreetMap')).toHaveCount(0);
  await expect(page.getByText('25.033, 121.5654')).toBeVisible();

  await page.getByRole('button', { name: 'Allow IP lookup' }).click();
  await page.getByRole('navigation', { name: 'Site documents' })
    .getByRole('button', { name: 'Privacy', exact: true }).click();
  await page.getByRole('button', { name: 'Reset all preferences' }).click();
  expect(await page.evaluate(() => window.localStorage.getItem('small_web_tools_consent'))).toBeNull();
});
