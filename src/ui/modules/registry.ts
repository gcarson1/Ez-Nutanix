// Every module: its content (talk track, key numbers, ...) and its component.
// The shell renders the header and presenter panel from `content`.
import type { FunctionComponent } from 'preact';
import type { ModuleContent } from '../../content/types';
import NciHub from './nci-hub';
import { content as NciHubC } from './nci-hub/content';
import ClusterLab from './cluster-lab';
import { content as ClusterLabC } from './cluster-lab/content';
import Datapath from './datapath';
import { content as DatapathC } from './datapath/content';
import Capacity from './capacity';
import { content as CapacityC } from './capacity/content';
import Failures from './failures';
import { content as FailuresC } from './failures/content';
import Lcm from './lcm';
import { content as LcmC } from './lcm/content';
import Network from './network';
import { content as NetworkC } from './network/content';
import Flow from './flow';
import { content as FlowC } from './flow/content';
import Dr from './dr';
import { content as DrC } from './dr/content';
import Snapshots from './snapshots';
import { content as SnapshotsC } from './snapshots/content';
import Security from './security';
import { content as SecurityC } from './security/content';
import Migration from './migration';
import { content as MigrationC } from './migration/content';
import Edge from './edge';
import { content as EdgeC } from './edge/content';
import Scale from './scale';
import { content as ScaleC } from './scale/content';
import Central from './central';
import { content as CentralC } from './central/content';
import Ncm from './ncm';
import { content as NcmC } from './ncm/content';
import Nkp from './nkp';
import { content as NkpC } from './nkp/content';
import Datalens from './datalens';
import { content as DatalensC } from './datalens/content';
import Storage from './storage';
import { content as StorageC } from './storage/content';
import Cnaos from './cnaos';
import { content as CnaosC } from './cnaos/content';
import Ndb from './ndb';
import { content as NdbC } from './ndb/content';
import Ai from './ai';
import { content as AiC } from './ai/content';
import Beacon from './beacon';
import { content as BeaconC } from './beacon/content';
import Cloud from './cloud';
import { content as CloudC } from './cloud/content';

export interface ModuleDef {
  content: ModuleContent;
  Component: FunctionComponent;
  icon: string;
  /** Parent route for breadcrumbs and Esc ("" = landing). */
  parent: string;
}

export const MODULES: ModuleDef[] = [
  { content: NciHubC, Component: NciHub, icon: 'layers', parent: '' },
  { content: ClusterLabC, Component: ClusterLab, icon: 'server', parent: 'nci' },
  { content: DatapathC, Component: Datapath, icon: 'zap', parent: 'nci' },
  { content: CapacityC, Component: Capacity, icon: 'shield', parent: 'nci' },
  { content: FailuresC, Component: Failures, icon: 'power', parent: 'nci' },
  { content: LcmC, Component: Lcm, icon: 'upgrade', parent: 'nci' },
  { content: NetworkC, Component: Network, icon: 'net', parent: 'nci' },
  { content: FlowC, Component: Flow, icon: 'lock', parent: 'nci' },
  { content: DrC, Component: Dr, icon: 'globe', parent: 'nci' },
  { content: SnapshotsC, Component: Snapshots, icon: 'clone', parent: 'nci' },
  { content: SecurityC, Component: Security, icon: 'shield', parent: 'nci' },
  { content: MigrationC, Component: Migration, icon: 'move', parent: 'nci' },
  { content: EdgeC, Component: Edge, icon: 'edge', parent: 'nci' },
  { content: ScaleC, Component: Scale, icon: 'plus', parent: 'nci' },
  { content: CentralC, Component: Central, icon: 'api', parent: '' },
  { content: NcmC, Component: Ncm, icon: 'gauge', parent: '' },
  { content: NkpC, Component: Nkp, icon: 'k8s', parent: '' },
  { content: DatalensC, Component: Datalens, icon: 'eye', parent: '' },
  { content: StorageC, Component: Storage, icon: 'file', parent: '' },
  { content: CnaosC, Component: Cnaos, icon: 'k8s', parent: '' },
  { content: NdbC, Component: Ndb, icon: 'db', parent: '' },
  { content: AiC, Component: Ai, icon: 'ai', parent: '' },
  { content: BeaconC, Component: Beacon, icon: 'beacon', parent: '' },
  { content: CloudC, Component: Cloud, icon: 'cloud', parent: '' },
];

export function findModule(path: string): ModuleDef | undefined {
  return MODULES.find((m) => m.content.path === path);
}
