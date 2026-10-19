import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/snapshots',
  title: 'Snapshots & Clones',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Snapshots copy a map of where the data lives, not the data itself, and clones start out sharing every block. Space is used only by what changes afterwards. Snapshots are local restore points, not backups.',
  priority: 'P1',
  talk: [
    'A virtual disk is a map: each logical block points to where the data physically lives in the storage fabric.',
    'A snapshot copies the map, not the data. That is why it completes almost immediately and starts out using no extra data space.',
    'After the snapshot, new writes go to new blocks and only the live disk’s map changes (redirect-on-write). The snapshot keeps pointing at the old blocks.',
    'A clone is a new writable disk built from a snapshot’s map. It is ready at once and shares every block until it changes one.',
    'Space grows only with change: the VM’s new writes and each clone’s own changes, stored at the container’s replication factor. That is what makes many test and development copies affordable.',
    'Snapshots are local protection, not backups: they live on the same cluster as the data. Replicate them to another site, or use a backup product, to protect against losing the cluster; replicated copies use space there too.',
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
    'Let one loop play and pause on the snapshot: the number of stored blocks does not change.',
    'Pause after the new writes: only the changed blocks add space, and the snapshot still points at the old ones.',
    'Pause on the clones: each shares every block until it writes its own.',
    'Then open Database Service for database clones built on the same mechanism, or Disaster Recovery for copying snapshots to another site.',
  ],
};
