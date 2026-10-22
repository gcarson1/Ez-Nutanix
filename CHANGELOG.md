# Changelog

## 1.1 (October 2026)

From a coworker review of 1.0. Sources for every new claim are in `docs/facts.md` section 13, and the choices are in `docs/decisions.md` rows 27 to 32.

- **Playback speed:** a 1x button next to Play picks 0.25x to 2x, like YouTube, for every animation. `<` and `>` step it.
- **Arrow keys:** Left and Right scrub the animation in small steps; with Shift they jump to the previous or next caption.
- **LCM Rolling Upgrade:** "Cluster already degraded" is gone. In "A node fails mid-upgrade" nothing hints at the failure until it happens; then HA restarts the VMs, the cluster rebuilds, and LCM holds until the node is repaired and data has caught up.
- **Disaster Recovery:** NearSync and Sync are one choice. New Metro Availability choice: sync replication under 5 ms round trip plus a Witness, with automatic failover that restarts the VMs, and live migration for a planned move.
- **Edge & ROBO:** "Nodes lose contact" now works on two and three nodes. New "Add a node": a single node can't be expanded, two nodes can grow to three from AOS 7.6, three nodes use Expand Cluster.
- **External storage:** NetApp ONTAP is a fourth array, over NFS. It is marked as announced, because it was not generally available yet as of October 22, 2026.
- The footer and About show the version, and the footer credit is larger.

## 1.0 (October 2026)

The first shared release: the landing slide and its modules, the Cluster & DSF Lab and the Failure Gauntlet, with the documentation review caveats and the replication factor and rebuild space recheck.
