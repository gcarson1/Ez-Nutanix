// Opens the built file, then every module, and checks it renders with no console errors.
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Module paths and titles, read from each module's content.ts (no app code is imported).
const DIR = resolve('src/ui/modules');
const MODULES = readdirSync(DIR)
  .filter((d) => existsSync(join(DIR, d, 'content.ts')))
  .map((d) => {
    const src = readFileSync(join(DIR, d, 'content.ts'), 'utf8');
    const get = (k: string) => (src.match(new RegExp(`\\b${k}:\\s*(['"])(.*?)\\1`)) || [])[2] ?? '';
    return { content: { path: get('path'), title: get('title') } };
  });

const FILE = pathToFileURL(resolve('dist/index.html')).href;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('landing page renders every pane and opens a module', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  await expect(page.getByRole('heading', { name: /One Platform For All Apps/ })).toBeVisible();
  for (const name of ['Prism Federation', 'Cloud Manager', 'Kubernetes Platform', 'Data Lens', 'Files, Objects', 'Cloud Native AOS', 'Database Service', 'Enterprise AI', 'Nutanix Cloud Infrastructure', 'AWS', 'Azure', 'Google Cloud', 'Any Bare Metal Linux']) {
    await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /Nutanix Cloud Infrastructure/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Nutanix Cloud Infrastructure');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /One Platform For All Apps/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guided tour walks the panes', async ({ page }) => {
  await page.goto(FILE);
  await page.getByRole('button', { name: 'Guided tour' }).click();
  const card = page.getByRole('dialog', { name: 'Guided tour' });
  await expect(card).toBeVisible();
  for (let i = 0; i < 4; i++) await card.getByRole('button', { name: 'Next' }).click();
  await expect(card.getByRole('button', { name: 'Open NCI' })).toBeVisible();
});

test('presenter, glossary and shortcuts open from the keyboard', async ({ page }) => {
  await page.goto(`${FILE}#/nci/cluster`);
  await expect(page.locator('.mod-head h1')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('complementary', { name: /Presenter/ })).toBeVisible();
  await expect(page.getByText('Talk track')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await expect(page.getByRole('complementary', { name: 'Glossary' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
});

for (const m of MODULES) {
  test(`module ${m.content.path} renders`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${FILE}#/${m.content.path}`);
    await expect(page.locator('.mod-head h1')).toHaveText(m.content.title);
    await expect(page.locator('.mod svg.diagram').first()).toBeVisible();
    // Press play if the module has an animated sequence, let it run, and check for errors.
    const play = page.locator('.playbar button.primary').first();
    if (await play.count()) {
      await play.click();
      await page.waitForTimeout(1500);
    }
    expect(errors).toEqual([]);
  });
}

test('scenario state round-trips through the URL', async ({ page }) => {
  await page.goto(`${FILE}#/nci/cluster?nodes=12&rf=3&ft=3`);
  await page.reload();
  expect(page.url()).toContain('nodes=12');
  await page.getByLabel('Scenario preset').selectOption({ label: '4-node starter (RF2)' });
  await expect.poll(() => page.url()).toContain('nodes=4');
});
