// The top-bar search opens the module or option a keyword names, and its list of options
// (src/content/scenes.ts) stays in step with the tabs and choices the pages actually show.
import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { SCENES } from '../../src/content/scenes';

const FILE = pathToFileURL(resolve('dist/index.html')).href;
const DIR = resolve('src/ui/modules');
const PATHS = readdirSync(DIR)
  .filter((d) => existsSync(join(DIR, d, 'content.ts')))
  .map((d) => (readFileSync(join(DIR, d, 'content.ts'), 'utf8').match(/\bpath:\s*'(.*?)'/) || [])[1])
  .filter((p): p is string => !!p);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const hashOf = (path: string, params: Record<string, string> = {}) => {
  const q = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))).toString();
  return `#/${path}${q ? `?${q}` : ''}`;
};

test('"balance tcp" opens AHV Networking with the LACP bond picked', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  const box = page.getByRole('combobox', { name: 'Search modules and settings' });
  await box.fill('balance tcp');
  const first = page.getByRole('option').first();
  await expect(first).toContainText('LACP');
  await expect(first).toContainText('AHV Networking');
  await box.press('Enter');
  await expect(page).toHaveURL(/#\/nci\/network\?bond=lacp$/);
  await expect(page.locator('.mod-head h1')).toHaveText('AHV Networking');
  const lacp = page.getByRole('group', { name: 'Bond type' }).getByRole('button', { name: 'LACP' });
  await expect(lacp).toHaveAttribute('aria-pressed', 'true');
  await expect(lacp).toHaveClass(/found/);
  await expect(box).toHaveValue('');
  expect(errors).toEqual([]);
});

test('search works from the keyboard on any page: / focuses, arrows pick, Esc clears without leaving', async ({ page }) => {
  await page.goto(`${FILE}#/nci/cluster`);
  await expect(page.locator('.mod-head h1')).toBeVisible();
  await page.keyboard.press('/');
  const box = page.getByRole('combobox', { name: 'Search modules and settings' });
  await expect(box).toBeFocused();
  await page.keyboard.type('erasure');
  await expect(page.getByRole('option').first()).toContainText('Erasure coding (EC-X)');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(box).toHaveValue('');
  await expect(page).toHaveURL(/#\/nci\/cluster$/);
  await page.keyboard.type('metro availabilty');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/nci\/dr\?rep=metro$/);
  await expect(page.getByRole('group', { name: 'Replication' }).getByRole('button', { name: 'Metro Availability' })).toHaveAttribute('aria-pressed', 'true');
});

test('a module result opens the module, and no match says so', async ({ page }) => {
  await page.goto(FILE);
  const box = page.getByRole('combobox', { name: 'Search modules and settings' });
  await box.fill('qqqzz');
  await expect(page.getByText('No matches.')).toBeVisible();
  await box.fill('ransomware');
  await page.getByRole('option').first().click();
  await expect(page.locator('.mod-head h1')).toHaveText('Data Lens');
});

test('on a phone the search is an icon that opens over the top bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FILE}#/nci/network`);
  const box = page.getByRole('combobox', { name: 'Search modules and settings' });
  await expect(box).toBeHidden();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(box).toBeFocused();
  await box.fill('witness');
  await expect(page.getByRole('option').first()).toContainText('2 nodes + Witness');
  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(box).toBeHidden();
});

test('every option in the search list opens with that option picked', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FILE);
  const wrong: string[] = [];
  for (const s of SCENES) {
    await page.evaluate((h) => (location.hash = h), hashOf(s.path, s.params));
    const ok = await page
      .waitForFunction(
        ({ group, label }) =>
          [...document.querySelectorAll<HTMLElement>('main [role="tab"][aria-selected="true"], main .seg button[aria-pressed="true"]')].some(
            (b) => b.textContent?.trim() === label && (b.closest('[role="tablist"]') ?? b.closest('.seg'))?.getAttribute('aria-label') === group,
          ),
        { group: s.group, label: s.label },
        { timeout: 2000 },
      )
      .then(() => true, () => false);
    if (!ok) wrong.push(`${hashOf(s.path, s.params)}  ${s.group}: ${s.label}`);
  }
  expect(wrong, 'These src/content/scenes.ts entries no longer open a page with that option picked').toEqual([]);
});

test('every tab and choice on every page is in the search list', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FILE);
  const known = new Set(SCENES.map((s) => `${s.path}|${s.group}|${s.label}`));
  // Each module's default view, plus every listed option's view (tabs and choices reveal more choices).
  const views = [...new Set([...PATHS.map((p) => hashOf(p)), ...SCENES.map((s) => hashOf(s.path, s.params))])];
  const missing = new Set<string>();
  for (const h of views) {
    await page.evaluate((x) => (location.hash = x), h);
    await expect(page.locator('.mod-head h1')).toBeVisible();
    await page.waitForTimeout(60);
    const path = h.slice(2).split('?')[0];
    const controls = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main [role="tab"], main .seg button')].map((b) => ({
        group: (b.closest('[role="tablist"]') ?? b.closest('.seg'))?.getAttribute('aria-label') ?? '',
        label: b.textContent?.trim() ?? '',
      })),
    );
    for (const c of controls) if (!known.has(`${path}|${c.group}|${c.label}`)) missing.add(`{ path: '${path}', group: '${c.group}', label: '${c.label}' }`);
  }
  expect([...missing], 'Add these to src/content/scenes.ts (with the params that pick each one) so search can find them').toEqual([]);
});
