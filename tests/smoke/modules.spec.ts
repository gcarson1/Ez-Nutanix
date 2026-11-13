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
  for (const name of ['Prism Federation', 'Cloud Manager', 'Kubernetes Platform', 'Data Lens', 'Files, Objects', 'Cloud Native AOS', 'Database Service', 'Enterprise AI', 'Nutanix Cloud Infrastructure', 'Public cloud · NC2', 'OEM of your choice']) {
    await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
  }
  // The clouds' logos are part of the NC2 card: the card is the button, and Esc returns focus to it.
  await expect(page.getByRole('button', { name: 'AWS', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Public cloud · NC2/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Hybrid & Public Cloud');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /One platform for all apps/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Public cloud · NC2/ })).toBeFocused();
  await page.getByRole('button', { name: /Nutanix Cloud Infrastructure/ }).click();
  await expect(page.locator('.mod-head h1')).toHaveText('Nutanix Cloud Infrastructure');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: /One platform for all apps/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guided tour walks the panes, and its card never covers the part it describes', async ({ page }) => {
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto(FILE);
    await page.getByRole('button', { name: 'Take the tour' }).click();
    const card = page.getByRole('dialog', { name: 'Guided tour' });
    await expect(card).toBeVisible();
    for (let i = 0; i < 6; i++) {
      if (i) await card.getByRole('button', { name: 'Next' }).click();
      // Wait for the scroll to settle, then the spotlit part and the card must not overlap and both must be on screen.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const a = document.querySelector('.spot')!.getBoundingClientRect();
            const c = document.querySelector('.tour-card')!.getBoundingClientRect();
            const bar = document.querySelector('.bar')!.getBoundingClientRect().bottom;
            const apart = a.bottom <= c.top || c.bottom <= a.top;
            return apart && a.top >= bar && a.bottom <= innerHeight && c.top >= bar && c.bottom <= innerHeight;
          }),
          { message: `${size.width}x${size.height} step ${i + 1}` },
        )
        .toBe(true);
    }
    await expect(card.getByRole('button', { name: 'Open Nutanix Cloud Infrastructure' })).toBeVisible();
  }
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

// Nutanix 2.0 layout: at 1440x900 the picture starts high, the caption sits under it (not in the
// right column), and on animation pages the left column fits the window, so the page never scrolls.
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
    await expect(page.locator('.show-side .follow'), 'caption in the right column').toHaveCount(0);
    // Pages with a fitted picture (not hubs like NCI, which list tiles below) never scroll.
    if (await page.locator('.show-main.fits').count()) expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), 'page scroll').toBeLessThanOrEqual(0);
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

test('Kubernetes Platform: the story is the Overview, and every part has its own animation', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/nkp`);
  const tabs = page.getByRole('tablist', { name: 'Kubernetes Platform topics' });
  await expect(tabs.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.show-main .follow-k')).toHaveText(/Islands|Hidden work/);
  await expect(page.locator('.show-side')).toContainText('Also in NKP');
  const scenes: [tab: string, group: string | null, option: string, heading: RegExp][] = [
    ['Cluster lifecycle', 'Lifecycle', 'Create', /Declare the cluster|Cluster API builds it|in minutes|everywhere/],
    ['Cluster lifecycle', 'Lifecycle', 'Scale', /room to spare|Demand rises|autoscaler|Demand falls/],
    ['Cluster lifecycle', 'Lifecycle', 'Upgrade', /One cluster|Preflight|Platform applications|Workers|Upgraded/],
    ['Cluster lifecycle', 'Lifecycle', 'Self-heal', /healthy cluster|worker fails|restarts the pods|replaced/],
    ['Cluster lifecycle', 'Lifecycle', 'Air-gapped', /No way out|bundle|registry inside|mirror|checked images/],
    ['Dual-native', null, '', /virtual machines|NKP Metal|Physical workers|Kubernetes APIs|One operating model/],
    ['Fleet and tenants', 'Fleet', 'Workspaces', /Many clusters|Workspaces group|One sign-in|Tenants|Projects/],
    ['Fleet and tenants', 'Fleet', 'Attach a cluster', /did not create|Attach it|One view|upgrades stay/],
    ['Fleet and tenants', 'Fleet', 'GitOps', /lives in Git|a commit|Every cluster follows|Drift/],
    ['Fleet and tenants', 'Fleet', 'Observability', /is measured|One place|Insights|AI Navigator/],
    ['AI platform', null, '', /GPUs are scarce|queue|scheduler|four GPUs|catalog/],
    ['Apps and data', 'Apps and data', 'Traffic and storage', /request comes in|Ingress|Tenants cannot|Nutanix CSI|Shared storage/],
    ['Apps and data', 'Apps and data', 'Backup and recovery', /more than its data|Velero|mistake|NDK|recovers/],
  ];
  for (const [tab, group, option, heading] of scenes) {
    await tabs.getByRole('tab', { name: tab }).click();
    if (group) await page.getByRole('group', { name: group }).getByRole('button', { name: option }).click();
    await expect(page.locator('.show-main .follow-k'), `${tab} ${option}`).toHaveText(heading);
    await expect(page.locator('.show-main svg.diagram'), `${tab} ${option}`).toHaveCount(1);
    expect(await page.locator('.steps li').count(), `${tab} ${option}`).toBeGreaterThanOrEqual(4);
  }
  // Each scene ends on its outcome: play the last one to the end.
  await page.locator('.playbar input.scrub').evaluate((r: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, r.max);
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.show-foot .kpis')).toContainText('Running at site B');
  // The lifecycle tab points to the upgrade animation instead of repeating it.
  await tabs.getByRole('tab', { name: 'Cluster lifecycle' }).click();
  await page.getByRole('link', { name: /LCM Rolling Upgrade/ }).click();
  await expect(page).toHaveURL(/#\/nci\/lcm\?tab=k8s$/);
  expect(errors).toEqual([]);
});

test('Enterprise AI opens on the Overview, which ends with every team on one platform', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/ai`);
  await expect(page.getByRole('tablist', { name: 'Enterprise AI topics' }).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.show-main .follow-k')).toHaveText(/Every team wants AI|NAI on Kubernetes/);
  expect(await page.locator('.steps li').count()).toBe(6);
  await page.locator('.playbar input.scrub').evaluate((r: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, r.max);
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.show-main .follow-k')).toHaveText('One platform for every team');
  await expect(page.locator('.show-foot .kpis')).toContainText('4 of 4');
  await expect(page.locator('.show-foot .kpis')).toContainText('Your data center');
  // A link from before the Overview still opens Model endpoint with its choice picked.
  await page.goto(`${FILE}#/ai?w=cloud`);
  await expect(page.getByRole('tablist', { name: 'Enterprise AI topics' }).getByRole('tab', { name: 'Model endpoint' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: 'Where it runs' }).getByRole('button', { name: 'Public cloud' })).toHaveAttribute('aria-pressed', 'true');
  // ...and its choice does not trap the page there: the Overview tab still opens the Overview.
  await page.getByRole('tablist', { name: 'Enterprise AI topics' }).getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByRole('tablist', { name: 'Enterprise AI topics' }).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('Enterprise AI: every feature has its own animation, with tech previews named and no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/ai`);
  const tabs = page.getByRole('tablist', { name: 'Enterprise AI topics' });
  const scenes: [tab: string, group: string, option: string, heading: RegExp, preview: boolean][] = [
    ['GPUs', 'GPU use', 'Share a GPU', /takes a whole GPU|MIG|slice/, false],
    ['GPUs', 'GPU use', 'Span GPUs', /one GPU|Tensor parallelism|Every GPU/, false],
    ['GPUs', 'GPU use', 'Span nodes', /one node|Pipeline parallelism|stage|throughput/, true],
    ['GPUs', 'GPU use', 'Hibernate', /GPU is taken|Hibernate|freed GPUs|Resume/, false],
    ['Faster answers', 'Technique', 'Speculative decoding', /token|draft model|guess|passes/, false],
    ['Faster answers', 'Technique', 'KV-cache offload', /notes|evicted|host memory|starts fast/, true],
    ['Models and data', 'Capability', 'Fine-tuning', /smaller model|LoRA|metrics|imported|Serve it/, false],
    ['Models and data', 'Capability', 'Roles and sharing', /catalog|Share only|role|refused/, false],
    ['Models and data', 'Capability', 'Grounded answers', /training|Upload|passages|cites/, false],
  ];
  for (const [tab, group, option, heading, preview] of scenes) {
    await tabs.getByRole('tab', { name: tab }).click();
    await page.getByRole('group', { name: group }).getByRole('button', { name: option }).click();
    await expect(page.locator('.show-main .follow-k'), option).toHaveText(heading);
    await expect(page.locator('.show-main svg.diagram'), option).toHaveCount(1);
    // Every step of the scene has a chip, and a preview feature says so in the picture and the numbers.
    expect(await page.locator('.steps li').count(), option).toBeGreaterThanOrEqual(3);
    await expect(page.locator('svg.diagram').getByText('Tech preview'), option).toHaveCount(preview ? 1 : 0);
    if (preview) await expect(page.locator('.show-foot .kpis'), option).toContainText('Tech preview');
  }
  // The feature list on the Model endpoint tab opens the scene it names.
  await tabs.getByRole('tab', { name: 'Model endpoint' }).click();
  await page.getByRole('link', { name: 'Grounded answers' }).click();
  await expect(page).toHaveURL(/#\/ai\?o=rag&tab=own$/);
  await expect(page.getByRole('group', { name: 'Capability' }).getByRole('button', { name: 'Grounded answers' })).toHaveAttribute('aria-pressed', 'true');
  // The list that held the link is gone, so focus moves to the tab it opened.
  await expect(tabs.getByRole('tab', { name: 'Models and data' })).toBeFocused();
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

test('Data Lens: Unusual activity shows the fixed rule missing a mass delete and UBA flagging it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${FILE}#/datalens`);
  await page.getByRole('tab', { name: 'Unusual activity' }).click();
  await expect(page).toHaveURL(/#\/datalens\?tab=ua$/);
  await page.getByRole('button', { name: /One fixed rule for everyone/ }).click();
  await page.locator('.playbar input.scrub').evaluate((r: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(r, '7');
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.show-foot .kpis')).toContainText('Missed');
  // Each step's chip lands on a picture that already matches its caption.
  await page.getByRole('button', { name: /Ben’s deletes flagged/ }).click();
  await expect(page.locator('.show-foot .kpis')).toContainText('Flagged');
  await expect(page.locator('.diagram')).toContainText('Anomaly · ben');
  await page.getByRole('button', { name: /Schedules and exclusions/ }).click();
  await expect(page.locator('.show-foot .kpis')).toContainText('svc-backup');
  await expect(page.locator('.diagram')).toContainText('Alerts today: 2');
  expect(errors).toEqual([]);
});

const ALL_PAGES = ['nci', 'nci/hci', 'nci/cluster', 'nci/datapath', 'nci/capacity', 'nci/snapshots', 'nci/failures', 'nci/lcm', 'nci/network', 'nci/flow', 'nci/security', 'nci/dr', 'nci/move', 'nci/edge', 'central', 'ncm', 'nkp', 'datalens', 'storage', 'cnaos', 'ndb', 'ai', 'beacon', 'cloud', 'oem', 'partial'];

test('every page opens its right pane with Release version and License needed, and a Cloud Manager scene shows its own license', async ({ page }) => {
  const errors = watchErrors(page);
  for (const path of ALL_PAGES) {
    await page.goto(`${FILE}#/${path}`);
    const facts = page.locator('.show-facts .kpi');
    await expect(facts, path).toHaveCount(2);
    await expect(facts.nth(0).locator('.k'), path).toHaveText('Release version');
    await expect(facts.nth(1).locator('.k'), path).toHaveText('License needed');
    await expect(facts.nth(0).locator('.v'), path).not.toHaveText('');
    await expect(facts.nth(1).locator('.v'), path).not.toHaveText('');
  }
  await page.goto(`${FILE}#/ncm`);
  await expect(page.locator('.show-facts .kpi').nth(1).locator('.v')).toHaveText('NCM Starter to Ultimate');
  await page.getByRole('tab', { name: 'Security' }).click();
  await expect(page.locator('.show-facts .kpi').nth(1).locator('.v')).toHaveText('NCM Ultimate');
  // A tab or choice that needs something different shows its own lines.
  const lic = page.locator('.show-facts .kpi').nth(1).locator('.v');
  const rel = page.locator('.show-facts .kpi').nth(0).locator('.v');
  await page.goto(`${FILE}#/partial?tab=esxi`);
  await expect(lic).toHaveText('Nutanix license');
  await page.goto(`${FILE}#/partial`);
  await expect(lic).toHaveText('NCI-C (NCI Compute)');
  await page.goto(`${FILE}#/cnaos?on=metal`);
  await expect(rel).toHaveText('Early access');
  await expect(lic).toHaveText('NKP Pro or Ultimate');
  await page.goto(`${FILE}#/nci/lcm?tab=k8s`);
  await expect(lic).toHaveText('NKP Ultimate');
  await page.goto(`${FILE}#/nci/flow?tab=net`);
  await expect(lic).toHaveText('Listed from NCI Pro');
  expect(errors).toEqual([]);
});
