import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ndb',
  title: 'Database Service',
  tag: 'Platform services',
  summary:
    'Nutanix Database Service (NDB) makes database provisioning, protection, cloning and patching self-service. Its Time Machine combines snapshots with captured transaction logs to recover or clone to a precise point in time.',
  priority: 'P1',
  facts: {
    release: { v: 'NDB 2.11', sub: 'Jul 2026' },
    license: { v: 'NDB, per core', sub: 'No editions; per cluster or per VM', tip: 'Per physical cluster: all its cores, unlimited VMs. Per VM: the vCPUs NDB manages, with NCI licensed separately. The two can be mixed.' },
  },
  talk: [
    'Start with the pain: a dropped table, a test team waiting days for a copy, patch nights for dozens of databases.',
    'Time Machine: recover to one minute before the mistake. NDB uses the nearest earlier snapshot and replays transaction logs to that point.',
    'Recover side by side as a clone to pull back just what you need, or restore in place when you want production rolled back. A test clone can be given a retention period, here a week, and NDB deletes it automatically when it runs out.',
    'Database clones come from AOS snapshots, the same mechanism as in Snapshots & Clones: ready in minutes, using space only for what they change.',
    'Provisioning and patching follow profiles the database administrator (DBA) defines once, so every database is built and patched the same way.',
    'Engines in NDB 2.11: Oracle, SQL Server, PostgreSQL (including pgvector), EDB Postgres, MySQL, MariaDB and MongoDB. Recovery, high availability (HA) and disaster recovery (DR) options differ by engine and version.',
  ],
  numbers: [
    { k: 'Engines', v: 'Oracle, SQL Server, PostgreSQL, EDB Postgres, MySQL, MariaDB and MongoDB' },
    { k: 'Point-in-time recovery', v: 'To the second within retention, up to the last log catch-up; details vary by engine' },
    { k: 'NDB on Nutanix Cloud Clusters (NC2)', v: 'AWS, Azure and Google Cloud' },
  ],
  qa: [
    {
      q: 'How close to “now” can we recover?',
      a: 'Up to the last transaction-log catch-up that Time Machine has captured. The catch-up interval is part of the service level agreement (SLA) you choose; a shorter interval means a smaller gap.',
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
  next: [
    'On the Time Machine tab, play Recover as Clone beside production and pause on Clone ready.',
    'Switch Recover as to Restore in place and pause on Production rolled back.',
    'On the Provisioning tab, pause on Database created: the standbys follow every change on the primary.',
    'On the Patching tab, pause on Primary role moves.',
    'Then open Disaster Recovery for a copy of the database at another site.',
  ],
  then: ['nci/dr', 'nci/snapshots'],
};
