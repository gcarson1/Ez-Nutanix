import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/failures',
  title: 'Failure Gauntlet',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Pick a failure: a drive, a Controller VM (CVM), a node, a whole block, two nodes at once, or a nearly full cluster. Watch detection, VM restarts and self-healing on a loop, with RF2 or RF3.',
  priority: 'P0',
  talk: [
    'Start with a node power-off. The cluster notices within seconds, HA (high availability) restarts that node’s VMs on other hosts, typically in about one to two minutes, and re-protection starts right away.',
    'Point at the lines: every surviving node copies some of the missing data at the same time. That many-to-many rebuild is why it gets faster as the cluster grows, unlike a rebuild into one spare drive.',
    'Stop only a CVM: nothing restarts. The host keeps its VMs and their I/O is served by other CVMs over the network until it returns.',
    'Now the honest part: with RF2, a second failure before the rebuild finishes can make some data unavailable. Whether it does depends on which failure domains hold the copies and how much free space is left. Pick “Two nodes at once” and compare RF2 with RF3.',
    'Finish with the cannot-self-heal case: a nearly full cluster. The caption says exactly why.',
  ],
  numbers: [
    { k: 'Failures tolerated', v: 'RF2: 1 node or drive at a time · RF3: 2' },
    { k: 'HA restart', v: 'Starts about 60 s after a host fails; typically all restarted within about 120 s' },
    { k: 'Re-protection', v: 'Starts as soon as the failure is detected (not after a fixed wait)' },
    { k: 'Metadata ring', v: 'A node down for about 30 minutes is detached and its metadata share re-replicated' },
    { k: 'HA reservation', v: 'One host’s memory with RF2 containers · two hosts’ with RF3' },
    { k: 'Block / rack awareness', v: '3 blocks or racks at RF2 · 5 at RF3 (4 and 6 with EC-X)' },
  ],
  qa: [
    {
      q: 'How long does a rebuild take?',
      a: 'It depends on how much data the failed part held, how many nodes help, the hardware and how busy the cluster is. The estimate here is data divided by survivors times a per-node rate you can change, so treat it as a way to reason about scale, not a quote. Because every node helps, bigger clusters rebuild a failed node faster.',
    },
    {
      q: 'Is RF2 safe enough?',
      a: 'RF2 survives any one node or drive failure and then rebuilds itself, if there is free space for the missing copies. The exposure is a second failure before that rebuild finishes. For most clusters, RF2 with enough free space and good monitoring is the common choice. RF3, and block or rack awareness, are there when that window matters more, at the cost of capacity and some write overhead.',
    },
    {
      q: 'Will my VMs go down if a node fails?',
      a: 'The VMs on that node stop and are restarted by HA on other hosts, typically within a couple of minutes, so they see a reboot. VMs on other nodes keep running. By default restarts are best effort; turning on HA memory reservation holds back enough memory to guarantee them, which costs some usable memory.',
    },
  ],
  next: [
    'Node with RF2: let it play and pause on the moment HA restarts the VMs, then on the rebuild.',
    'Two nodes at once: compare RF2 with RF3. With RF2, the result depends on whether the two nodes share a block.',
    'Block (chassis): copies were kept in different blocks, so data stays available.',
    'Nearly full cluster: the survivors have no room, so it cannot self-heal; read the reason.',
    'Then open LCM Rolling Upgrade to show planned maintenance with no downtime.',
  ],
};
