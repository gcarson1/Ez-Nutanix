// Flow: Network Security (microsegmentation) and Virtual Networking (overlay VPCs).
import './style.css';
import { useEnum } from '../../../state/route';
import { NetSec } from './netsec';
import { VNet } from './vnet';

const TABS = [
  { id: 'sec', label: 'Flow Network Security' },
  { id: 'net', label: 'Flow Virtual Networking' },
] as const;

export default function Flow() {
  const [tab, setTab] = useEnum('tab', 'sec', ['sec', 'net'] as const);
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Flow">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p class="lede fl-lede">
        {tab === 'sec'
          ? 'Microsegmentation: firewall rules written against categories (labels on VMs) instead of IP addresses, enforced on every host at each VM’s network interface.'
          : 'Virtual networking: private networks (VPCs) created in software on top of the existing physical network, each free to reuse the same IP ranges.'}
      </p>
      {tab === 'sec' ? <NetSec key="sec" /> : <VNet key="net" />}
    </>
  );
}
