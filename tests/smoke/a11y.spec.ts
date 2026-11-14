// An automated accessibility pass (axe-core, WCAG 2 A and AA) over the home page, every module, and every
// tab or choice the search lists, in both themes. It finds what a scanner can find (contrast, names, roles,
// labels); keyboard and screen-reader behaviour are covered by the tests in modules.spec.ts.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PATHS } from './module-list';
import { SCENES } from '../../src/content/scenes';

const FILE = pathToFileURL(resolve('dist/index.html')).href;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Every distinct page state the search can open: a module, or a module with one tab or choice set.
const states = new Map<string, string>();
for (const p of ['', ...PATHS]) states.set(p || 'home', p);
for (const s of SCENES) {
  const q = new URLSearchParams(s.params ?? {}).toString();
  states.set(q ? `${s.path}?${q}` : s.path, q ? `${s.path}?${q}` : s.path);
}

// One page per theme, moving between states by hash (no reload), so the whole sweep stays a couple of minutes.
for (const theme of ['light', 'dark'] as const) {
  test(`axe ${theme}: ${states.size} pages and tabs`, async ({ browser }) => {
    test.setTimeout(420_000);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem('nax-theme', t), theme);
    const found: string[] = [];
    for (const [name, route] of states) {
      await page.goto(`${FILE}#/${route}`);
      await expect(page.locator('.mod h1, .slide-wrap').first(), name).toBeVisible();
      // The hash change re-renders the page; let it paint before scanning.
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const v of r.violations) found.push(`${name}: ${v.id} (${v.impact}): ${v.nodes.length} node(s), first ${v.nodes[0].html.slice(0, 120)}`);
    }
    expect(found).toEqual([]);
    await ctx.close();
  });
}
