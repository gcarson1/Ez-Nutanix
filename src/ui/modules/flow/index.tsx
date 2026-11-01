// Flow: Network Security (microsegmentation) and Virtual Networking (overlay VPCs), one tab each.
import { Tabs } from '../../components/show';
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
    <Tabs label="Flow" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'sec' ? <NetSec key="sec" /> : <VNet key="net" />}
    </Tabs>
  );
}
