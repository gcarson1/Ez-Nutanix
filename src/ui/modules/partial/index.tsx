// "Don't want the full stack?": two ways to start with part of Nutanix, one tab each.
// External storage keeps the customer's array under AHV compute nodes; ESXi on Nutanix keeps
// vSphere on Nutanix nodes and storage. The landing's band opens this module on either tab.
import { Tabs } from '../../components/show';
import { useEnum } from '../../../state/route';
import EsxiOnNutanix from './esxi';
import ExtStorage from './ext';
import './style.css';

type TabId = 'ext' | 'esxi';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ext', label: 'Nutanix with external storage' },
  { id: 'esxi', label: 'ESXi on Nutanix' },
];

export default function Partial() {
  const [tab, setTab] = useEnum<TabId>('tab', 'ext', ['ext', 'esxi']);
  return (
    <Tabs label="Ways to start" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'ext' && <ExtStorage />}
      {tab === 'esxi' && <EsxiOnNutanix />}
    </Tabs>
  );
}
