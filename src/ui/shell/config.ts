import raw from '../../config.json';
import { version } from '../../../package.json';

export interface AppConfig {
  title: string;
  presenterName: string;
  presenterRole: string;
  organization: string;
  contact: string;
  /** Credit line shown first in the footer, followed by the authors. */
  credit: string;
  /** Names after the credit, each with an optional Slack handle shown beneath it in purple. */
  authors?: { name: string; handle?: string }[];
  disclaimer: string;
  factsCheckedOn: string;
}

export const CONFIG: AppConfig = raw as AppConfig;

/** The release shown in the footer and About, from package.json: "1.1.0" reads "v1.1". */
export const VERSION = `v${version.replace(/\.0$/, '')}`;
