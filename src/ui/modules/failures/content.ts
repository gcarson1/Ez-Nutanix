import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/failures',
  title: 'Failure Gauntlet',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Pick a failure: a drive, a Controller VM (CVM), a node, a whole block, two nodes at once, or a nearly full cluster. Watch detection, VM restarts and self-healing on a loop, with RF2 or RF3.',
  priority: 'P0',
  talk: [
    'Start with a node power-off. The cluster notices within seconds, HA (high availability) restarts that node’s VMs on other hosts in about one to two minutes, and re-protection starts right away.',
    'Point at the lines: every surviving node copies some of the missing data at the same time. That many-to-many rebuild is why it gets faster as the cluster grows, unlike a rebuild into one spare drive.',
    'Stop only a CVM: nothing restarts. The host keeps its VMs and their I/O is served by other CVMs over the network until it returns.',
    'Now the honest part: a second failure during an RF2 rebuild makes some data unavailable, and the sim does not hide it. Pick “Two nodes at once”, then switch to RF3 to show the same failure survived.',
    'Finish with the cannot-self-heal case: a nearly full cluster. The caption says exactly why. The Cluster & DSF Lab shows the 3-node case too.',
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
      a: 'RF2 survives any one node or drive failure and then rebuilds itself. The exposure is a second failure before that rebuild finishes. For most clusters, RF2 with enough free space and good monitoring is the common choice. RF3, and block or rack awareness, are there when that window matters more, at the cost of capacity and some write overhead.',
    },
    {
      q: 'Will my VMs go down if a node fails?',
      a: 'The VMs on that node stop and are restarted by HA on other hosts, typically within a couple of minutes, so they see a reboot. VMs on other nodes keep running. By default restarts are best effort; turning on HA memory reservation holds back enough memory to guarantee them, which costs some usable memory.',
    },
  ],
  next: [
    'Node with RF2: let it play and pause on the moment HA restarts the VMs, then on the rebuild.',
    'Two nodes at once: RF2 loses access to some data; switch to RF3 and it survives.',
    'Block (chassis): copies were kept in different blocks, so data stays available.',
    'Nearly full cluster: the survivors have no room, so it cannot self-heal; read the reason.',
    'Then open LCM Rolling Upgrade to show planned maintenance with no downtime.',
  ],
  honest: [
    'On RF2, a second failure during a long rebuild is the real risk window. RF3, block awareness and rack awareness exist for that, and they cost capacity.',
    'Self-healing needs free space. A nearly full cluster cannot re-protect itself after a failure, so size for a rebuild reserve.',
    'HA restarts are a reboot for the VMs on the failed host. Applications still need their own start-up and clustering if they cannot tolerate that.',
    'HA is best effort unless memory is reserved, and the reservation (one or two hosts’ worth) is memory VMs cannot use.',
    'When a CVM is down, its host’s I/O crosses the network to other CVMs, so latency goes up until it returns.',
    'Timings and the rebuild rate in this sim are illustrative. Real values depend on hardware, workload and software version.',
  ],
};
