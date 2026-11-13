import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/snapshots',
  title: 'Snapshots & Clones',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Snapshots and clones are created almost instantly and use space only for what changes, because they copy a map of where data lives, not the data. They are local restore points, not backups.',
  priority: 'P1',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · AHV 11.2' },
    license: { v: 'NCI Starter or higher', sub: 'Snapshots and clones are listed in every NCI edition' },
  },
  talk: [
    'Tell it as an admin lives it: before patching sql-prod, a 500 GB database VM, take a snapshot. It copies the disk’s map of where data lives in the Distributed Storage Fabric (DSF), not the data, so it takes seconds and adds no space.',
    'The VM keeps writing. New writes go to new space and only the live disk’s map changes (redirect-on-write); the snapshot keeps the old data. Space grows only by what changed.',
    'The patch fails, so restore from the snapshot. Nothing is copied back, which is why it is quick; anything written after the snapshot is lost, so take it right before the change.',
    'Dev, test and analytics each get a clone: a full, writable disk to its team, ready in seconds and sharing every block until it changes one.',
    'Point at the meter: five 500 GB disks would be 2,500 GB as full copies; here about 550 GB is stored. Space is the container’s replication factor times that, for both sides alike.',
    'Snapshots are local protection, not backups: they live on the same cluster as the data. The Recovery points vs snapshots tab shows they are the same technology: a snapshot is the Prism Element and AHV term, taken by hand and kept on its cluster; a recovery point is the Prism Central term, made by hand or on a schedule by a protection policy for every VM in a category, kept locally and replicated with its own retention, and used by recovery plans.',
  ],
  numbers: [
    { k: 'Data copied to take a snapshot', v: 'None (map only)' },
    { k: 'New space for a fresh clone', v: 'None until it is written' },
    { k: 'Space a snapshot costs over time', v: 'Old blocks the live disk has since replaced, times the replication factor' },
  ],
  qa: [
    {
      q: 'Are snapshots a backup?',
      a: 'Not on their own. A local snapshot lives on the same cluster as the data, so it does not protect against losing the cluster. Replicate snapshots to another site or cloud, or use a backup product, for that. Snapshots are excellent for fast local restore points and clones.',
    },
    {
      q: 'Do lots of snapshots slow the VM down?',
      a: 'Taking a snapshot does not copy data, and writes after it go to new blocks without copying the old ones aside. The system still manages snapshot metadata in the background, so keep retention to what you need. Effects depend on workload and version.',
    },
    {
      q: 'How much space will my clones use?',
      a: 'As much as they change. A clone that rewrites 10% of its disk uses about 10% of the disk’s size in new space, times the replication factor. A clone that rewrites everything ends up as large as a full copy.',
    },
  ],
  next: [
    'Pause on Snapshot taken in seconds: the stored total does not move.',
    'Pause on The patch fails: restore, and say why it is quick.',
    'Pause on Clones grow only with their writes and compare Stored with As full copies.',
    'Then open Disaster Recovery to copy snapshots to another site, or Database Service for database clones built on the same mechanism.',
  ],
  then: ['nci/dr', 'ndb'],
};
