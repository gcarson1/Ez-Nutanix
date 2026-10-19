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
  await expect(page.getByLabel('Scenario preset')).toHaveCount(0);
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
    // Animations autoplay: let them run, scrub one if there is a scrub bar, and check for errors.
    await page.waitForTimeout(1500);
    const scrub = page.locator('.playbar input.scrub').first();
    if (await scrub.count()) {
      await scrub.fill('0');
      await expect(page.locator('.playbar .pbtn').first()).toHaveAttribute('aria-label', 'Play');
    }
    expect(errors).toEqual([]);
  });
}

test('cluster lab: scenario buttons sit above the picture and switch the story', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/cluster`);
  const pick = page.getByRole('group', { name: 'Choose what to show' });
  for (const name of ['Data placement', 'Live migration', 'Planned shutdown', 'VM failover', 'Drive failure']) {
    await expect(pick.getByRole('button', { name })).toBeVisible();
  }
  const pickBox = await pick.boundingBox();
  const picBox = await page.locator('.dl-dia').boundingBox();
  expect(pickBox!.y).toBeLessThan(picBox!.y);
  await pick.getByRole('button', { name: 'VM failover' }).click();
  await expect(pick.getByRole('button', { name: 'VM failover' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.url()).toContain('sc=failover');
  await expect(page.getByRole('complementary', { name: /VM failover/ }).getByRole('heading', { name: 'VM failover' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('protection & capacity: erasure coding and blocks-and-racks tabs render and switch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/capacity`);
  const tabs = page.getByRole('tablist', { name: 'Protection topics' });
  await tabs.getByRole('tab', { name: /Erasure coding/ }).click();
  await expect.poll(() => page.url()).toContain('tab=ec');
  await expect(page.locator('.mod svg.diagram').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'RF2 · 4/1 strips' })).toHaveAttribute('aria-pressed', 'true');
  await tabs.getByRole('tab', { name: 'Blocks and racks' }).click();
  await page.getByRole('button', { name: 'Node only' }).click();
  await expect.poll(() => page.url()).toContain('aw=node');
  await expect(page.locator('.mod svg.diagram').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('full-stack band opens the external storage and ESXi tabs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  await page.getByRole('button', { name: /ESXi on Nutanix/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Don’t want the full stack?');
  const tabs = page.getByRole('tablist', { name: 'Ways to start' });
  await expect(tabs.getByRole('tab', { name: 'ESXi on Nutanix' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Convert to AHV later' }).click();
  await expect.poll(() => page.url()).toContain('go=conv');
  await expect(page.locator('.mod svg.diagram').first()).toBeVisible();
  await tabs.getByRole('tab', { name: 'Nutanix with external storage' }).click();
  await page.getByRole('button', { name: 'Dell PowerFlex' }).click();
  await expect.poll(() => page.url()).toContain('ar=pf');
  await expect(page.locator('.kpi .v', { hasText: 'Dell SDC' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Any Bare Metal Linux opens Cloud Native AOS on bare metal', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  await page.getByRole('button', { name: /Any Bare Metal Linux/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Cloud Native AOS');
  await expect(page.getByRole('button', { name: 'Bare metal (NKP Metal)' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Amazon EKS' }).click();
  await expect.poll(() => page.url()).not.toContain('on=metal');
  await expect(page.locator('.kpi .v', { hasText: 'GA · 1.0' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Presets show only on the modules that use the shared cluster', async ({ page }) => {
  for (const path of ['nci/capacity', 'nci/scale']) {
    await page.goto(`${FILE}#/${path}`);
    await expect(page.getByLabel('Scenario preset')).toBeVisible();
  }
  for (const path of ['nkp', 'nci/failures']) {
    await page.goto(`${FILE}#/${path}`);
    await expect(page.locator('.mod-head h1')).toBeVisible();
    await expect(page.getByLabel('Scenario preset')).toHaveCount(0);
  }
});

test('failure gauntlet: failure buttons and steps sit above the picture; RF choice only for two nodes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/failures`);
  const pick = page.getByRole('group', { name: 'What fails' });
  for (const name of ['Drive', 'Controller VM', 'Node', 'Block', 'Two nodes', 'Nearly full']) await expect(pick.getByRole('button', { name, exact: true })).toBeVisible();
  const steps = page.getByRole('list', { name: 'Steps' });
  expect((await steps.boundingBox())!.y).toBeLessThan((await page.locator('.gx-dia').boundingBox())!.y);
  await expect(page.getByRole('group', { name: 'Copies kept' })).toHaveCount(0);
  await pick.getByRole('button', { name: 'Two nodes', exact: true }).click();
  await expect.poll(() => page.url()).toContain('sc=double');
  await page.getByRole('group', { name: 'Copies kept' }).getByRole('button', { name: '3 (RF3)' }).click();
  await expect.poll(() => page.url()).toContain('cp=3');
  await steps.getByRole('button', { name: /Recovery/ }).click();
  await expect(steps.locator('[aria-current="step"]')).toContainText('Recovery');
  expect(errors).toEqual([]);
});

test('protection & capacity: RF2 opens on 3 nodes, RF3 moves to 5, and picking 8 sticks', async ({ page }) => {
  await page.goto(`${FILE}#/nci/capacity`);
  const nodes = page.getByRole('group', { name: 'Nodes' });
  await expect(nodes.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'RF3 · 3 copies' }).click();
  await expect(nodes.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await nodes.getByRole('button', { name: '8', exact: true }).click();
  await expect.poll(() => page.url()).toContain('nodes=8');
  await page.getByRole('button', { name: 'RF2 · 2 copies' }).click();
  await expect(nodes.getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('scenario state round-trips through the URL', async ({ page }) => {
  await page.goto(`${FILE}#/nci/capacity?nodes=12&rf=3&ft=3`);
  await page.reload();
  expect(page.url()).toContain('nodes=12');
  await page.getByLabel('Scenario preset').selectOption({ label: '4-node starter (RF2)' });
  await expect.poll(() => page.url()).toContain('nodes=4');
});
