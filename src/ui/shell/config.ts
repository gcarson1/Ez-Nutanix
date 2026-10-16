import raw from '../../config.json';

export interface AppConfig {
  title: string;
  presenterName: string;
  presenterRole: string;
  organization: string;
  contact: string;
  disclaimer: string;
  factsCheckedOn: string;
}

export const CONFIG: AppConfig = raw as AppConfig;
