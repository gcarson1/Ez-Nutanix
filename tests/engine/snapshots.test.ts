import { describe, it, expect } from 'vitest';
import { initial, snapshot, write, cloneFrom, deleteDisk, usedBlocks, fullCopyBlocks, exclusiveBlocks, walkthrough } from '../../src/engine/snapshots';

describe('snapshots and clones (block-map model)', () => {
  it('a snapshot is metadata only: no new blocks', () => {
    const s0 = initial(8);
    const s1 = snapshot(s0, 'vm');
    expect(usedBlocks(s1).size).toBe(usedBlocks(s0).size);
    expect(s1.disks.find((d) => d.kind === 'snapshot')!.map).toEqual(s0.disks[0].map);
  });

  it('writes after a snapshot redirect to new blocks and leave the snapshot unchanged', () => {
    const s1 = snapshot(initial(8), 'vm');
    const s2 = write(s1, 'vm', [2, 5]);
    expect(usedBlocks(s2).size).toBe(10);
    const snap = s2.disks.find((d) => d.id === 'snap1')!;
    const vm = s2.disks.find((d) => d.id === 'vm')!;
    expect(snap.map).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(vm.map[2]).not.toBe(2);
    expect(vm.map[0]).toBe(0); // unchanged blocks still shared
    expect(s2.fresh).toHaveLength(2);
  });

  it('a clone is instant and shares all blocks until it is written', () => {
    const s1 = snapshot(initial(8), 'vm');
    const s2 = cloneFrom(cloneFrom(s1, 'snap1'), 'snap1');
    expect(usedBlocks(s2).size).toBe(8);
    expect(fullCopyBlocks(s2)).toBe(32);
    const s3 = write(s2, 'clone1', [0, 1, 2]);
    expect(usedBlocks(s3).size).toBe(11);
    expect(exclusiveBlocks(s3, 'clone1')).toBe(3);
    expect(exclusiveBlocks(s3, 'clone2')).toBe(0);
  });

  it('snapshots cannot be written', () => {
    const s1 = snapshot(initial(4), 'vm');
    expect(write(s1, 'snap1', [0])).toBe(s1);
  });

  it('deleting a snapshot frees only blocks no one else uses', () => {
    let s = snapshot(initial(8), 'vm');
    s = write(s, 'vm', [0, 1]);
    expect(usedBlocks(s).size).toBe(10);
    expect(exclusiveBlocks(s, 'snap1')).toBe(2);
    s = deleteDisk(s, 'snap1');
    expect(usedBlocks(s).size).toBe(8);
  });

  it('walkthrough: space grows only with new writes', () => {
    for (const clones of [1, 2, 3, 4])
      for (const changePct of [0, 25, 50]) {
        const steps = walkthrough({ blocks: 8, clones, changePct });
        const used = steps.map((st) => usedBlocks(st.state).size);
        expect(used[1]).toBe(used[0]); // snapshot
        expect(used[3]).toBe(used[2]); // clones
        const per = Math.round((8 * changePct) / 100);
        expect(used[4] - used[3]).toBeLessThanOrEqual(clones * per);
        expect(used[4]).toBeLessThan(fullCopyBlocks(steps[4].state) + 1);
      }
  });
});
