// The top-bar search: a few words, typos included, should open the module or the exact option.
import { describe, expect, it } from 'vitest';
import { MODULES } from '../../src/ui/modules/registry';
import { MODULE_WORDS, SCENES } from '../../src/content/scenes';
import { buildIndex, highlight, normalize, search, stem } from '../../src/engine/search';

const index = buildIndex(MODULES, SCENES, MODULE_WORDS);
const first = (q: string) => {
  const h = search(index, q)[0];
  return h && `${h.doc.path}${Object.keys(h.doc.params).length ? `?${new URLSearchParams(h.doc.params)}` : ''} ${h.doc.title}`;
};

describe('search', () => {
  it('finds the option a keyword names, not just its module', () => {
    expect(first('balance tcp')).toBe('nci/network?bond=lacp LACP');
    expect(first('balance-tcp')).toBe('nci/network?bond=lacp LACP');
    expect(first('metro')).toBe('nci/dr?rep=metro Metro Availability');
    expect(first('erasure coding')).toBe('nci/capacity?tab=ec Erasure coding (EC-X)');
    expect(first('floating ip')).toBe('nci/flow?tab=net&vp=fip In from the internet');
    expect(first('time machine')).toBe('ndb Time Machine');
    expect(first('hyper-v')).toBe('nci/move?src=hyperv Hyper-V');
    expect(first('split brain')).toBe('nci/edge?ev=peer Nodes lose contact');
  });

  it('opens a module by its title, initials or another name for it', () => {
    expect(first('disaster recovery')).toBe('nci/dr Disaster Recovery');
    expect(first('dr')).toBe('nci/dr Disaster Recovery');
    expect(first('nkp')).toBe('nkp Kubernetes Platform');
    expect(first('hyperconverged')).toMatch(/^nci/);
    expect(first('ransomware')).toBe('datalens Data Lens');
    expect(first('3 tier')).toBe('nci/hci Legacy vs Nutanix HCI');
  });

  it('tolerates typos and half-typed words', () => {
    expect(first('balanse tcp')).toBe('nci/network?bond=lacp LACP');
    expect(first('metro availabilty')).toBe('nci/dr?rep=metro Metro Availability');
    expect(first('kubernets')).toMatch(/Kubernetes Platform|Cloud Native AOS/);
    expect(first('near sync')).toBe('nci/dr?rep=nearsync NearSync / Sync');
    expect(first('quarant')).toMatch(/^nci\/flow/);
  });

  it('prefers a word as typed over a near miss', () => {
    // "cost" is a tab; "lost" (one letter away) is only in an unrelated option.
    const hits = search(index, 'cost').map((h) => h.doc.title);
    expect(hits[0]).toBe('Cost');
    expect(hits).not.toContain('Unplanned (site lost)');
  });

  it('returns nothing for filler or a single letter', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, 'b')).toEqual([]);
    expect(search(index, 'zzzzqx')).toEqual([]);
  });

  it('caps the list and shows the matching tooltip for an option', () => {
    expect(search(index, 'node').length).toBeLessThanOrEqual(8);
    expect(search(index, 'balance tcp')[0].snippet).toBe('Prism: Active-Active (balance-tcp with LACP)');
  });

  it('indexes every option against a module that exists', () => {
    for (const s of SCENES) expect(MODULES.some((m) => m.content.path === s.path), s.path).toBe(true);
    for (const p of Object.keys(MODULE_WORDS)) expect(MODULES.some((m) => m.content.path === p), p).toBe(true);
    expect(index.docs.length).toBe(MODULES.length + SCENES.length);
  });
});

describe('search text handling', () => {
  it('normalizes punctuation, case and accents', () => {
    expect(normalize('Active-Active (balance-TCP)')).toBe('active active balance tcp');
    expect(normalize('Don’t café')).toBe('don t cafe');
  });

  it('stems plurals and verb endings the same way on both sides', () => {
    expect(stem('copies')).toBe(stem('copy'));
    expect(stem('fails')).toBe(stem('fail'));
    expect(stem('nodes')).toBe('node');
    expect(stem('cross')).toBe('cross');
  });

  it('marks matched words, joining a hyphenated pair into one highlight', () => {
    const parts = highlight('Prism: Active-Active (balance-tcp with LACP)', 'balance tcp');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['balance-tcp']);
  });
});
