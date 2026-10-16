import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/failures',
  title: 'Failure Gauntlet',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Break a drive, a Controller VM (CVM), a node, a block or a rack, or several at once. Watch detection, VM restarts and self-healing on a timeline you can scrub, and compare RF2 with RF3 on the same failure.',
  priority: 'P0',
  talk: [
    'Start with a node power-off. The cluster notices within seconds, HA (high availability) restarts that node’s VMs on other hosts in about one to two minutes, and re-protection starts right away.',
    'Point at the lines: every surviving node copies some of the missing data at the same time. That many-to-many rebuild is why it gets faster as the cluster grows, unlike a rebuild into one spare drive.',
    'Stop only a CVM: nothing restarts. The host keeps its VMs and their I/O is served by other CVMs over the network until it returns.',
    'Now the honest part: a second failure during an RF2 rebuild makes some data unavailable, and the sim does not hide it. Switch on the RF2 vs RF3 comparison to show the same script surviving on RF3.',
    'Finish with the cannot-self-heal cases: a nearly full cluster, or a 3-node cluster after a node loss. The rail says exactly why and what fixes it.',
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
    'Node power-off: play it, then scrub back to the moment HA restarts the VMs.',
    'Second failure during rebuild: run it, then switch Compare to RF2 vs RF3.',
    'Block failure: compare awareness off vs on.',
    'Nearly full cluster: read the “cannot self-heal” reason and fix.',
    'Try the Gauntlet game for a few rounds.',
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
