// The registry is the one list the hub, breadcrumbs, jump dialog and presenter links read from.
import { describe, expect, it } from 'vitest';
import { MODULES, findModule } from '../../src/ui/modules/registry';

describe('module registry', () => {
  it('gives every module its own path and icon', () => {
    const paths = MODULES.map((m) => m.content.path);
    const icons = MODULES.map((m) => m.icon);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('puts every module under a parent that exists', () => {
    for (const m of MODULES) if (m.parent) expect(findModule(m.parent), m.content.path).toBeDefined();
  });

  it('opens old Scale-Out links in the module that absorbed it', () => {
    expect(findModule('nci/scale')?.content.path).toBe('nci/hci');
  });

  it('links presenter "open next" entries only to registered modules', () => {
    for (const m of MODULES) for (const p of m.content.then ?? []) expect(findModule(p), `${m.content.path} → ${p}`).toBeDefined();
  });
});
