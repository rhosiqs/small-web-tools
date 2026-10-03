import { expect, test } from '@playwright/test';

test('font extractor renders metadata and never fetches discovered font files', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', (request) => requestedUrls.push(request.url()));

  await page.route('**/api/extract-fonts', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        fonts: [{
          name: 'demo.woff2',
          family: 'Demo',
          format: 'WOFF2',
          weight: '400',
          style: 'normal',
          stretch: 'normal',
          unicodeRange: 'U+0000-00FF',
          variationSettings: 'unknown',
          isVariable: false,
          sourceHost: 'fonts.example.test',
        }],
        truncation: {
          truncated: true,
          reasons: ['stylesheets'],
        },
      }),
    });
  });

  await page.goto('/home/fontextractor');
  await page.getByLabel('Website URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Scan declarations' }).click();
  await expect(page.getByText(/blocked until you allow/)).toBeVisible();
  await page.getByRole('button', { name: 'Allow website analysis' }).click();
  await expect(page.getByText(/blocked until you allow/)).toBeHidden();
  await page.getByRole('button', { name: 'Scan declarations' }).click();

  await expect(page.getByText('Source host')).toBeVisible();
  await expect(page.getByText('fonts.example.test')).toBeVisible();
  await expect(page.getByText(/Results may be incomplete/)).toBeVisible();
  expect(requestedUrls.some((url) => url.includes('fonts.example.test'))).toBe(false);
  expect(requestedUrls.some((url) => url.includes(['/api', 'font-proxy'].join('/')))).toBe(false);
});
