import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ndb',
  title: 'Database Service',
  tag: 'Platform services',
  summary:
    'Nutanix Database Service (NDB) turns database provisioning, protection, cloning and patching into self-service operations. Time Machine combines snapshots with captured transaction logs so you can recover or clone to a precise point in time.',
  priority: 'P1',
  talk: [
    'Start with the pain: a dropped table, a test team waiting days for a copy, patch nights for dozens of databases.',
    'Time Machine: drag back to one minute before the mistake. NDB uses the nearest earlier snapshot and replays transaction logs to that point.',
    'Recover side by side as a clone to pull back just what you need, or restore in place when you want production rolled back.',
    'Thin clones come from AOS snapshots: they are ready in minutes and use space only for what they change.',
    'Provisioning and patching follow profiles the DBA defines once, so every database is built and patched the same way.',
    'Engines in NDB 2.11: Oracle, SQL Server, PostgreSQL (including pgvector), EDB Postgres, MySQL, MariaDB and MongoDB.',
  ],
  numbers: [
    { k: 'Current release', v: 'NDB 2.11 (Jul 2026)' },
    { k: 'Engines', v: 'Oracle, SQL Server, PostgreSQL, EDB Postgres, MySQL, MariaDB, MongoDB' },
    { k: 'Point-in-time recovery', v: 'To the second, within retention' },
    { k: 'NDB on NC2', v: 'AWS, Azure, Google Cloud' },
  ],
  qa: [
    {
      q: 'How close to “now” can we recover?',
      a: 'Up to the last transaction-log catch-up that Time Machine has captured. The catch-up interval is part of the SLA you choose; a shorter interval means a smaller gap.',
    },
    {
      q: 'Do clones slow down production?',
      a: 'Clones are created from snapshots, not by copying the data, so creating them does not read the whole database. Clones that run heavy workloads still share the cluster’s resources, so place and size them like any other workload.',
    },
    {
      q: 'Does it replace our backup software?',
      a: 'Time Machine gives fast operational recovery and cloning on the platform. Most organizations still keep backups or replicas at another site for disaster recovery and long-term retention; design both together.',
    },
  ],
  next: ['Snapshots & Clones', 'Disaster Recovery', 'Hybrid & Public Cloud'],
  honest: [
    'Recovery is bounded by the last log catch-up and the retention window; data written after the last catch-up is not yet recoverable.',
    'Feature support differs by engine and version (for example HA topologies and patching options); check the NDB compatibility matrix.',
    'Thin clones save space only while they change a fraction of the data; a clone that rewrites everything grows to a full copy.',
    'NDB itself is a set of VMs (control plane and agents) that need sizing, protection and upgrades.',
  ],
};
