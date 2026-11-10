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
  await expect(page.getByRole('heading', { name: /One platform for all apps/ })).toBeVisible();
  for (const name of ['Prism Federation', 'Cloud Manager', 'Kubernetes Platform', 'Data Lens', 'Files, Objects', 'Cloud Native AOS', 'Database Service', 'Enterprise AI', 'Nutanix Cloud Infrastructure', 'AWS', 'Azure', 'Google Cloud', 'OEM of your choice']) {
    await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /Nutanix Cloud Infrastructure/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Nutanix Cloud Infrastructure');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /One platform for all apps/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guided tour walks the panes', async ({ page }) => {
  await page.goto(FILE);
  await page.getByRole('button', { name: 'Take the tour' }).click();
  const card = page.getByRole('dialog', { name: 'Guided tour' });
  await expect(card).toBeVisible();
  for (let i = 0; i < 5; i++) await card.getByRole('button', { name: 'Next' }).click();
  await expect(card.getByRole('button', { name: 'Open Nutanix Cloud Infrastructure' })).toBeVisible();
});

test('the theme button opens a menu with dark and light', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  await page.getByRole('button', { name: 'Theme' }).click();
  const menu = page.getByRole('menu', { name: 'Theme' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(2);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await menu.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(menu).toHaveCount(0);
  expect(errors).toEqual([]);
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

// Nutanix 2.0 layout: at 1440x900 the picture starts high and the play bar is on screen without scrolling.
for (const m of MODULES) {
  test(`module ${m.content.path} fits the first screen`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${FILE}#/${m.content.path}`);
    const dia = page.locator('.mod svg.diagram').first();
    await expect(dia).toBeVisible();
    expect((await dia.boundingBox())!.y, 'diagram top').toBeLessThan(260);
    const bar = page.locator('.playbar').first();
    if (await bar.count()) {
      const b = (await bar.boundingBox())!;
      expect(b.y + b.height, 'play bar bottom').toBeLessThanOrEqual(900);
    }
  });
}

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
  const pick = page.getByRole('group', { name: 'What happens' });
  for (const name of ['Data placement', 'Live migration', 'Planned shutdown', 'VM failover', 'Drive failure', 'CVM fails']) {
    await expect(pick.getByRole('button', { name })).toBeVisible();
  }
  const pickBox = await pick.boundingBox();
  const picBox = await page.locator('.dl-dia').boundingBox();
  expect(pickBox!.y).toBeLessThan(picBox!.y);
  await pick.getByRole('button', { name: 'VM failover' }).click();
  await expect(pick.getByRole('button', { name: 'VM failover' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.url()).toContain('sc=failover');
  await expect(page.getByRole('list', { name: 'Steps' })).toContainText('Node 2 fails');
  expect(errors).toEqual([]);
});

test('protection & capacity: erasure coding and blocks-and-racks tabs render and switch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/capacity`);
  const tabs = page.getByRole('tablist', { name: 'Protection topics' });
  await tabs.getByRole('tab', { name: /Erasure coding/ }).click();
  await expect.poll(() => page.url()).toContain('tab=ec');
  await expect(page.locator('.mod svg.diagram').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'RF2 · 4/1 strip' })).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.locator('.xs-table tr', { hasText: 'Dell PowerFlex' })).toContainText('Dell SDC in the CVM');
  expect(errors).toEqual([]);
});

test('OEM of your choice opens the hardware page with every vendor', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(FILE);
  await page.getByRole('button', { name: /OEM of your choice/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('OEM of Your Choice');
  await expect(page.getByRole('list', { name: 'Runs on' }).locator('li')).toHaveText(['Nutanix NX', 'Dell', 'HPE', 'Lenovo', 'Cisco', 'Fujitsu', 'Supermicro']);
  expect(errors).toEqual([]);
});

test('failure gauntlet: failure buttons sit above the picture, steps and caption below it, all on one screen; RF choice only for two nodes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/failures`);
  const pick = page.getByRole('group', { name: 'What fails' });
  for (const name of ['Drive', 'Controller VM', 'Node', 'Block', 'Two nodes', 'Nearly full']) await expect(pick.getByRole('button', { name, exact: true })).toBeVisible();
  const steps = page.getByRole('list', { name: 'Steps' });
  expect((await pick.boundingBox())!.y).toBeLessThan((await page.locator('.gx-dia').boundingBox())!.y);
  await expect(page.locator('.show-main').getByRole('list', { name: 'Steps' })).toBeVisible();
  await expect(page.locator('.show-main .follow')).toBeVisible();
  await expect(page.locator('.show-side .follow')).toHaveCount(0);
  const dia = (await page.locator('.gx-dia').boundingBox())!;
  expect((await steps.boundingBox())!.y).toBeGreaterThan(dia.y + dia.height);
  // The left column fits the screen: the page itself does not scroll.
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
  await expect(page.getByRole('group', { name: 'Copies' })).toHaveCount(0);
  await pick.getByRole('button', { name: 'Two nodes', exact: true }).click();
  await expect.poll(() => page.url()).toContain('sc=double');
  await page.getByRole('group', { name: 'Copies' }).getByRole('button', { name: 'RF3 · 3 copies' }).click();
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
  await page.getByRole('group', { name: 'Nodes' }).getByRole('button', { name: '8', exact: true }).click();
  await expect.poll(() => page.url()).toContain('nodes=8');
});

test('playback speed: the 1x button picks a speed every animation shares', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/edge`);
  const btn = page.locator('.playbar .speed-btn');
  await expect(btn).toHaveText('1x');
  await btn.click();
  const menu = page.getByRole('menu', { name: 'Playback speed' });
  await expect(menu.getByRole('menuitemradio')).toHaveText(['0.25', '0.5', '0.75', '✓Normal', '1.25', '1.5', '1.75', '2']);
  await menu.getByRole('menuitemradio', { name: '2', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(btn).toHaveText('2x');
  await page.keyboard.press('Shift+Comma');
  await expect(btn).toHaveText('1.75x');
  await page.goto(`${FILE}#/nci/lcm`);
  await expect(page.locator('.playbar .speed-btn')).toHaveText('1.75x');
  expect(errors).toEqual([]);
});

test('edge: the outcomes table picks size and event; nodes lose contact needs two nodes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/edge`);
  const table = page.locator('.edge-matrix');
  const cell = (size: string, ev: string) => table.locator('tbody tr', { has: page.locator('th', { hasText: size }) }).locator('td').nth(['Drive fails', 'Node fails', 'Nodes lose contact', 'Link to the data center drops', 'Planned upgrade', 'Add a node'].indexOf(ev)).getByRole('button');
  await expect(cell('1 node', 'Nodes lose contact')).toBeDisabled();
  await expect(cell('2 nodes + Witness', 'Nodes lose contact')).toBeEnabled();
  await expect(cell('3 nodes', 'Nodes lose contact')).toBeEnabled();
  await cell('3 nodes', 'Nodes lose contact').click();
  await expect(cell('3 nodes', 'Nodes lose contact')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.url()).toContain('ev=peer');
  await expect.poll(() => page.url()).toContain('sz=3');
  await cell('1 node', 'Add a node').click();
  await expect.poll(() => page.url()).toContain('ev=expand');
  await expect(page.locator('.kpi .v', { hasText: 'Not supported' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('disaster recovery: NearSync and Sync share a choice, and Metro Availability live-migrates a planned move', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/dr`);
  const rep = page.getByRole('group', { name: 'Replication' });
  await expect(rep.getByRole('button')).toHaveText(['Async', 'NearSync / Sync', 'Metro Availability']);
  await rep.getByRole('button', { name: 'Metro Availability' }).click();
  await page.getByRole('button', { name: 'Planned failover' }).click();
  await expect.poll(() => page.url()).toContain('rep=metro');
  await expect(page.locator('.kpi .v', { hasText: 'No downtime' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('LCM: the failure scenario gives nothing away before the node fails', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/lcm?sc=fail`);
  await expect(page.getByRole('group', { name: 'What happens' }).getByRole('button')).toHaveText(['Healthy cluster', 'A node fails mid-upgrade']);
  const scrub = page.locator('.playbar input.scrub');
  await scrub.fill('0');
  await expect(page.locator('.lcm-dia')).not.toContainText('failed');
  await expect(page.locator('.lcm-dia')).not.toContainText('LCM holds');
  // a range input only takes values on its step, so set it the way a drag would
  await scrub.evaluate((r: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, String(Number(r.max) * 0.55));
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.lcm-dia')).toContainText('failed');
  await expect(page.locator('.lcm-dia')).toContainText('LCM holds');
  expect(errors).toEqual([]);
});

test('legacy vs HCI: three tiers fold into one node, then nodes form a cluster', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci`);
  await page.locator('.subgrid .subtile').first().click();
  await expect(page.locator('.mod-head h1')).toHaveText('Legacy vs Nutanix HCI');
  const scrub = page.locator('.playbar input.scrub');
  const seek = (f: number) =>
    scrub.evaluate((r: HTMLInputElement, f) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, String(Number(r.max) * f));
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }, f);
  const dia = page.locator('.hci-dia');
  // match the key exactly: "nodes on Ethernet" under Tiers to run would also match "Nodes"
  const kpi = (k: string) => page.locator('.kpi').filter({ has: page.locator('.k', { hasText: new RegExp(`^${k}$`) }) }).locator('.v');
  await seek(0.1);
  await expect(dia).toContainText('FC switch');
  // the 3-tier hosts sit on the same top-of-rack switches the cluster keeps
  await expect(dia).toContainText('VM and management traffic');
  await expect(kpi('Consoles')).toHaveText('3');
  // the three tiers are named on the left
  await expect(dia.locator('text.hci-tier-l')).toHaveText(['Compute', 'Networking', 'Storage']);
  await seek(0.48);
  await expect(dia).toContainText('Array controllers');
  // faded-out 3-tier parts are unmounted, not left at opacity 0
  await expect(dia).not.toContainText('FC switch');
  await expect(dia.locator('text.hci-tier-l')).toHaveCount(0);
  await seek(1);
  await expect(kpi('Nodes')).toHaveText('5');
  await expect(kpi('Consoles')).toHaveText('1');
  await expect(kpi('Storage controllers')).toHaveText('5');
  await expect(dia).toContainText('Top-of-rack switches');
  // Scale-Out vs 3-Tier was folded in here; its old links open this module
  await page.goto(`${FILE}#/nci/scale`);
  await expect(page.locator('.mod-head h1')).toHaveText('Legacy vs Nutanix HCI');
  expect(errors).toEqual([]);
});

test('Enterprise AI: the Agent Gateway tab routes, falls back, rate-limits and governs tools', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/ai`);
  await page.getByRole('tablist', { name: 'Enterprise AI topics' }).getByRole('tab', { name: 'Agent Gateway' }).click();
  await expect.poll(() => page.url()).toContain('tab=gw');
  const dia = page.locator('.gw-dia');
  await expect(dia).toContainText('Unified endpoint');
  await expect(dia).toContainText('MCP Gateway');
  await page.locator('.playbar input.scrub').evaluate((r: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, r.max);
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(dia).toContainText('customers.update · denied');
  expect(errors).toEqual([]);
});

test('external storage names every array with its own technology, no picker, NetApp counted as announced, and the footer shows the release', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/partial`);
  await expect(page.locator('.xs-table tbody b')).toHaveText(['Everpure FlashArray', 'Dell PowerStore', 'Dell PowerFlex', 'NetApp ONTAP']);
  await expect(page.locator('.xs-by')).toHaveText(['NVMe/TCP · FlashArray APIs', 'NVMe/TCP · PowerStore APIs (AOS 7.6)', 'Dell SDC in the CVM', 'NFS · ONTAP APIs (AFF, select FAS)']);
  // A plain list, not a picker: nothing above the picture is a toggle.
  await expect(page.locator('.show-top [aria-pressed]')).toHaveCount(0);
  await expect(page.locator('.xs-dia')).toContainText('Your existing array');
  await expect(page.locator('.kpi', { hasText: 'Supported arrays' })).toContainText('NetApp announced');
  await expect(page.locator('.kpi', { hasText: 'Supported arrays' }).locator('.v')).toHaveText('4');
  await expect(page.locator('.foot-bar .ver')).toHaveText('v1.1');
  expect(errors).toEqual([]);
});

test('the home page footer sits at the bottom of a tall window and shows the Slack handles', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${FILE}#/`);
  await expect(page.locator('.foot-bar .handle')).toHaveText(['@Besaw', '@GabeC on Slack']);
  const m = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, bottom: document.querySelector('.foot-bar')!.getBoundingClientRect().bottom }));
  expect(m.doc).toBeLessThanOrEqual(1080);
  expect(Math.round(m.bottom)).toBe(1080);
  expect(errors).toEqual([]);
});

test('arrow keys pause and scrub the animation in steps', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nci/dr`);
  const scrub = page.locator('.playbar input.scrub');
  await page.locator('.mod-head h1').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.playbar .pbtn')).toHaveAttribute('aria-label', 'Play');
  const max = Number(await scrub.getAttribute('max'));
  const a = Number(await scrub.inputValue());
  await page.keyboard.press('ArrowRight');
  const b = Number(await scrub.inputValue());
  expect(b - a).toBeCloseTo(max / 40, 1);
  await page.keyboard.press('ArrowLeft');
  expect(Number(await scrub.inputValue())).toBeCloseTo(a, 1);
  await page.keyboard.press('Shift+ArrowRight');
  const c = Number(await scrub.inputValue());
  expect(c).toBeGreaterThan(a);
  await page.keyboard.press('Shift+ArrowLeft');
  expect(Number(await scrub.inputValue())).toBeLessThan(c);
  expect(errors).toEqual([]);
});
