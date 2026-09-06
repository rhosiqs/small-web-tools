import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const networkInventory = JSON.parse(readFileSync(
  new URL('../config/network-services.json', import.meta.url),
  'utf8',
));
const declaredHosts = new Set(networkInventory.flatMap((service) => service.domains));

test('fresh initial load makes no undeclared or Google Fonts requests', async ({ page }) => {
  const externalSubresources = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.hostname !== '127.0.0.1'
      && request.resourceType() !== 'document'
      && !request.isNavigationRequest()
    ) {
      externalSubresources.push(url.hostname);
    }
  });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(externalSubresources.filter((host) => !declaredHosts.has(host))).toEqual([]);
  expect(externalSubresources.filter((host) => (
    host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com'
  ))).toEqual([]);
});

test('the privacy page carries the network inventory and the consent settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/home\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  await expect(page.getByText('FFmpeg WebAssembly Runtime').first()).toBeVisible();
  await expect(page.getByText('Google Fonts Recommendations').first()).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Service consent settings', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Network services', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Allow / }).first()).toBeVisible();
});

test('every footer document link opens its own page', async ({ page }) => {
  const documents = [
    ['About', '/home/about'],
    ['Privacy', '/home/privacy'],
    ['Terms of Use', '/home/terms'],
    ['Security', '/home/security'],
    ['License', '/home/license'],
  ];
  await page.goto('/');
  for (const [label, route] of documents) {
    await page.getByRole('navigation', { name: 'Site documents' })
      .getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole('heading', { name: label, level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('FFmpeg is disclosed persistently and requested only after processing starts', async ({ page }) => {
  const unpkgRequests = [];
  const apiUploads = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://unpkg.com/')) unpkgRequests.push(request);
    if (request.url().includes('/api/') && request.postDataBuffer()?.length) apiUploads.push(request);
  });
  await page.route('https://unpkg.com/**', (route) => route.abort());

  await page.goto('/home/mediasplit');
  await expect(page.getByText(/downloads the pinned FFmpeg 0\.12\.6/)).toBeVisible();
  expect(unpkgRequests).toHaveLength(0);

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'local-test.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('local media never uploaded'),
  });
  await page.getByRole('button', { name: 'Start Processing Queue' }).click();
  await expect.poll(() => unpkgRequests.length).toBeGreaterThan(0);
  expect(unpkgRequests.every((request) => request.method() === 'GET')).toBe(true);
  expect(apiUploads).toHaveLength(0);
});
