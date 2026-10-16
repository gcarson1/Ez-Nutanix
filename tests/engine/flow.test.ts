import { describe, it, expect } from 'vitest';
import { evaluate, matches, setQuarantine, type FlowVm, type Policies } from '../../src/engine/flow';

const vm = (id: string, env: string, tier: string, host: string): FlowVm => ({
  id,
  name: id,
  cats: { AppType: 'HR', AppTier: tier, Environment: env },
  host,
  ip: '10.0.0.1',
});

const VMS: FlowVm[] = [
  vm('pweb1', 'Production', 'Web', 'h1'),
  vm('pweb2', 'Production', 'Web', 'h2'),
  vm('papp', 'Production', 'App', 'h2'),
  vm('pdb', 'Production', 'DB', 'h3'),
  vm('dweb', 'Dev', 'Web', 'h1'),
  vm('ddb', 'Dev', 'DB', 'h3'),
];

function pol(over: Partial<{ appMode: 'monitor' | 'enforce'; isoMode: 'monitor' | 'enforce'; iso: boolean; intra: boolean }> = {}): Policies {
  return {
    apps: [
      {
        id: 'hr',
        type: 'app',
        name: 'HR Production',
        mode: over.appMode ?? 'enforce',
        enabled: true,
        target: { AppType: 'HR', Environment: 'Production' },
        intraTier: over.intra ?? false,
        rules: [
          { id: 'r1', from: 'any', toTier: 'Web', port: 443 },
          { id: 'r2', from: { AppType: 'HR', AppTier: 'Web', Environment: 'Production' }, toTier: 'App', port: 8080 },
          { id: 'r3', from: { AppType: 'HR', AppTier: 'App', Environment: 'Production' }, toTier: 'DB', port: 5432 },
        ],
      },
    ],
    isolations: [
      { id: 'iso', type: 'isolation', name: 'Prod / Dev', mode: over.isoMode ?? 'enforce', enabled: over.iso ?? true, a: { Environment: 'Production' }, b: { Environment: 'Dev' } },
    ],
    quarantine: { vms: {}, forensicFrom: { AppType: 'Forensics' } },
  };
}

describe('category matching', () => {
  it('matches only when every key in the selector matches', () => {
    expect(matches({ AppType: 'HR', Environment: 'Dev' }, { AppType: 'HR' })).toBe(true);
    expect(matches({ AppType: 'HR', Environment: 'Dev' }, { AppType: 'HR', Environment: 'Production' })).toBe(false);
    expect(matches({ AppType: 'HR' }, {})).toBe(false);
  });
  it('policies target categories, not IPs: changing a VM IP does not change the verdict', () => {
    const p = pol();
    const a = evaluate({ src: 'pweb1', dst: 'papp', port: 8080 }, VMS, p);
    const reIp = VMS.map((v) => (v.id === 'papp' ? { ...v, ip: '192.0.2.99' } : v));
    const b = evaluate({ src: 'pweb1', dst: 'papp', port: 8080 }, reIp, p);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});

describe('application policy', () => {
  it('allows listed flows', () => {
    expect(evaluate({ src: 'external', dst: 'pweb1', port: 443 }, VMS, pol()).allowed).toBe(true);
    expect(evaluate({ src: 'pweb1', dst: 'papp', port: 8080 }, VMS, pol()).allowed).toBe(true);
    expect(evaluate({ src: 'papp', dst: 'pdb', port: 5432 }, VMS, pol()).allowed).toBe(true);
  });
  it('denies anything not listed (default deny), enforced at the destination vNIC', () => {
    const v = evaluate({ src: 'pweb1', dst: 'pdb', port: 5432 }, VMS, pol());
    expect(v.allowed).toBe(false);
    expect(v.at).toBe('h3');
    expect(v.hits.some((h) => h.action === 'deny' && h.kind === 'app')).toBe(true);
    expect(evaluate({ src: 'pweb1', dst: 'papp', port: 22 }, VMS, pol()).allowed).toBe(false);
  });
  it('blocks same-tier traffic unless intra-tier is allowed', () => {
    expect(evaluate({ src: 'pweb1', dst: 'pweb2', port: 445 }, VMS, pol()).allowed).toBe(false);
    expect(evaluate({ src: 'pweb1', dst: 'pweb2', port: 445 }, VMS, pol({ intra: true })).allowed).toBe(true);
  });
  it('monitor mode logs what it would block but allows it', () => {
    const v = evaluate({ src: 'pweb1', dst: 'pdb', port: 5432 }, VMS, pol({ appMode: 'monitor' }));
    expect(v.allowed).toBe(true);
    expect(v.wouldDrop).toBe(true);
    expect(v.hits.some((h) => h.action === 'would-deny')).toBe(true);
  });
});

describe('isolation policy', () => {
  it('blocks traffic between environments in both directions', () => {
    expect(evaluate({ src: 'dweb', dst: 'pdb', port: 5432 }, VMS, pol()).allowed).toBe(false);
    expect(evaluate({ src: 'pweb1', dst: 'ddb', port: 5432 }, VMS, pol()).allowed).toBe(false);
  });
  it('does not affect traffic inside an environment', () => {
    expect(evaluate({ src: 'dweb', dst: 'ddb', port: 5432 }, VMS, pol()).allowed).toBe(true);
  });
  it('takes precedence over an application allow rule', () => {
    // Port 443 to a Production web VM is allowed for "any" source, but Dev is isolated from Production.
    expect(evaluate({ src: 'dweb', dst: 'pweb1', port: 443 }, VMS, pol()).allowed).toBe(false);
  });
  it('in monitor mode, logs and allows', () => {
    const v = evaluate({ src: 'dweb', dst: 'ddb', port: 1 }, VMS, pol({ isoMode: 'monitor' }));
    expect(v.allowed).toBe(true);
    const x = evaluate({ src: 'pweb1', dst: 'ddb', port: 5432 }, VMS, pol({ isoMode: 'monitor' }));
    expect(x.allowed).toBe(true);
    expect(x.wouldDrop).toBe(true);
  });
});

describe('quarantine', () => {
  it('overrides allow rules for traffic out of and into the VM', () => {
    const p = pol();
    p.quarantine = setQuarantine(p.quarantine, 'pweb1', 'strict');
    expect(evaluate({ src: 'pweb1', dst: 'papp', port: 8080 }, VMS, p).allowed).toBe(false);
    expect(evaluate({ src: 'external', dst: 'pweb1', port: 443 }, VMS, p).allowed).toBe(false);
  });
  it('overrides monitor mode: quarantine is always enforced', () => {
    const p = pol({ appMode: 'monitor', isoMode: 'monitor', iso: false });
    p.quarantine = setQuarantine(p.quarantine, 'dweb', 'strict');
    expect(evaluate({ src: 'dweb', dst: 'ddb', port: 445 }, VMS, p).allowed).toBe(false);
  });
  it('forensic quarantine admits only the forensic sources', () => {
    const tools: FlowVm = { id: 'tools', name: 'tools', cats: { AppType: 'Forensics' }, host: 'h2', ip: '10.0.9.9' };
    const all = [...VMS, tools];
    const p = pol();
    p.quarantine = setQuarantine(p.quarantine, 'pdb', 'forensic');
    expect(evaluate({ src: 'tools', dst: 'pdb', port: 22 }, all, p).allowed).toBe(true);
    expect(evaluate({ src: 'papp', dst: 'pdb', port: 5432 }, all, p).allowed).toBe(false);
    p.quarantine = setQuarantine(p.quarantine, 'pdb', null);
    expect(evaluate({ src: 'papp', dst: 'pdb', port: 5432 }, all, p).allowed).toBe(true);
  });
});

describe('policy follows the VM', () => {
  it('produces the same verdict after live migration, enforced on the new host', () => {
    const p = pol();
    const before = evaluate({ src: 'pweb1', dst: 'pdb', port: 5432 }, VMS, p);
    // A live migration changes only the VM's host; its categories (and so its policies) go with it.
    const moved = VMS.map((v) => (v.id === 'pdb' ? { ...v, host: 'h1' } : v));
    const after = evaluate({ src: 'pweb1', dst: 'pdb', port: 5432 }, moved, p);
    expect(before.allowed).toBe(false);
    expect(after.allowed).toBe(false);
    expect(before.at).toBe('h3');
    expect(after.at).toBe('h1');
    const okAfter = evaluate({ src: 'papp', dst: 'pdb', port: 5432 }, moved, p);
    expect(okAfter.allowed).toBe(true);
  });
});
