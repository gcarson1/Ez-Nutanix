// Flow: Network Security (microsegmentation) and Virtual Networking (overlay VPCs), one tab each.
import './style.css';
import { useEnum } from '../../../state/route';
import { NetSec } from './netsec';
import { VNet } from './vnet';

const TABS = [
  { id: 'sec', label: 'Network Security' },
  { id: 'net', label: 'Virtual Networking' },
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
          ? 'Firewall rules written against labels on VMs instead of IP addresses, and checked on every host right at each VM’s network connection.'
          : 'Private networks (VPCs) created in software on top of the existing physical network, each free to reuse the same IP ranges.'}
      </p>
      {tab === 'sec' ? <NetSec key="sec" /> : <VNet key="net" />}
    </>
  );
}
