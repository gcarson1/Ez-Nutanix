import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/failures',
  title: 'Failure Gauntlet',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Pick what fails, from one drive to two nodes at once, and watch an 8-node cluster ride through it step by step.',
  priority: 'P0',
  talk: [
    'Start with Node. Walk the steps above the picture: the node fails, HA (high availability) restarts its VMs on other nodes, typically in about two minutes, and every surviving node re-creates the missing copies at once.',
    'Point at the lines under the nodes: every node copies some of the missing data at the same time. That many-to-many rebuild is why it gets faster as the cluster grows, unlike a rebuild into one spare drive.',
    'Controller VM: nothing restarts. The host keeps its VMs and their I/O goes to other CVMs over the network until the CVM is back.',
    'Now the honest part: pick Two nodes. With two copies (RF2), pieces that had both copies on those nodes go red: unavailable until a node returns. Switch Copies kept to 3 (RF3) and the same failure is survived. In a real cluster, how much is affected depends on how copies are spread across failure domains.',
    'Finish with Nearly full: the survivors run out of space, so the cluster cannot fully re-protect itself. That is why sizing keeps a node’s worth of space free.',
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
      a: 'It depends on how much data the failed part held, how many nodes help, the hardware and how busy the cluster is. Time here is compressed so each failure plays in seconds. Because every node helps, bigger clusters rebuild a failed node faster.',
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
    'Node: click through the steps above the picture, or let it play; it pauses briefly after each step.',
    'Two nodes: these two are in different blocks, so with 2 copies some data goes red (unavailable); switch Copies kept to 3 and it survives.',
    'Block: copies were kept in different blocks, so a whole chassis can fail with nothing unavailable.',
    'Nearly full: drives fill up before every copy is back; read the outcome on the right.',
    'Then open LCM Rolling Upgrade to show planned maintenance with no downtime.',
  ],
};
