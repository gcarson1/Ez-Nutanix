// The file is sometimes viewed inside an embedded preview that loads it as an
// about:srcdoc iframe. There, history.replaceState with a URL throws a SecurityError.
// The app must keep working (state lives in memory) and must not log errors.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('works inside an about:srcdoc preview frame', async ({ page }) => {
  const html = readFileSync(resolve('dist/index.html'), 'utf8');
  const escaped = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const host = join(mkdtempSync(join(tmpdir(), 'nax-')), 'host.html');
  writeFileSync(host, `<!doctype html><html><body style="margin:0"><iframe style="width:1600px;height:900px;border:0" srcdoc="${escaped}"></iframe></body></html>`);

  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(pathToFileURL(host).href);

  const app = page.frameLocator('iframe');
  await app.getByRole('button', { name: /Nutanix Cloud Infrastructure/ }).click();
  await expect(app.locator('.mod-head h1')).toHaveText('Nutanix Cloud Infrastructure');
  await app.getByRole('button', { name: /Data Security/ }).click();
  await expect(app.locator('.mod-head h1')).toHaveText('Data Security');

  // A URL-backed control: the choice must stick even though the URL can't change.
  const stolen = app.getByRole('button', { name: 'A whole node is stolen' });
  await stolen.click();
  await expect(stolen).toHaveAttribute('aria-pressed', 'true');

  // Copy link explains instead of copying an unusable about:srcdoc address.
  await app.getByRole('button', { name: 'Copy link' }).click();
  await expect(app.locator('.toast')).toContainText('Open the HTML file in a browser');

  // Back still works through the in-memory route.
  await app.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(app.locator('.mod-head h1')).toHaveText('Nutanix Cloud Infrastructure');

  expect(errors).toEqual([]);
});
