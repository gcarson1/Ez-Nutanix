// Legend for the generic cluster diagram (ClusterDiagram), used by the Failure Gauntlet.
import { Legend } from '../../components/controls';

export function DiagramLegend({ ecx }: { ecx: boolean }) {
  return (
    <>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Copy local to its VM' },
          { color: 'var(--s2)', label: ecx ? 'Other copy or EC-X data' : 'Copy on another node' },
          ...(ecx ? [{ color: 'var(--flow)', label: 'EC-X parity' }] : []),
          { color: 'var(--warn)', label: 'Under-replicated (one copy short)' },
          { color: 'var(--bad)', label: 'No copy online' },
          { color: 'var(--s2)', label: 'Copy on an offline node', dashed: true },
        ]}
      />
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Rebuild copy (line)' },
          { color: 'var(--s2)', label: 'Disk balancing', dashed: true },
          { color: 'var(--ink-fg)', label: 'Localize after a move', dashed: true },
          { color: 'var(--warn)', label: 'HA restart', dashed: true },
          { color: 'var(--flow)', label: 'I/O redirected', dashed: true },
        ]}
      />
    </>
  );
}
