import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ncm',
  title: 'Cloud Manager',
  tag: 'Nutanix Central',
  summary:
    'Nutanix Cloud Manager (NCM) adds operations on top of the platform: anomaly detection that learns what normal looks like, self-service provisioning under quotas, cost budgets kept on-premises and security compliance checks.',
  priority: 'P1',
  talk: [
    'Four parts: Intelligent Operations (AIOps), Self-Service (formerly Calm), Cost Governance (formerly Beam) and Security Compliance (formerly Security Central). From NCM 2.0 they run inside Nutanix Central on-premises instead of Prism Central, and NCM 2.1 added a smaller 3-node form factor.',
    'AIOps learns each VM’s normal range from its history instead of using a fixed threshold. In this picture a 3 a.m. spike is flagged though it stays under a 70% alarm; a busy-afternoon spike trips both.',
    'Intelligent Operations also forecasts capacity runway, so purchases are planned rather than reactive, and suggests right-sizing for over- and under-sized VMs.',
    'Self-Service: app teams order from a catalog; quota and approval policy are checked before anything is created, and the result arrives with owner, project and categories set. Over quota, the request is sent back with the reason.',
    'Cost: dev-test runs hot. Cost Governance meters it daily at your rates, alerts the owner in time to act, and lists idle and oversized VMs. Self-Service quota, approval and scheduler policies stop it coming back.',
    'Security Compliance scans settings against a baseline, suggests a fix per finding and catches drift. Tiers: Starter covers forecasting and right-sizing, Pro adds Cost Governance and Self-Service, Ultimate adds Security Compliance, multi-VM blueprints and approvals.',
  ],
  numbers: [
    { k: 'NCM components', v: 'Intelligent Operations · Self-Service · Cost Governance · Security Compliance' },
    { k: 'Self-Service & Cost Governance', v: 'From NCM Pro' },
    { k: 'Security Compliance, multi-VM blueprints, approvals', v: 'NCM Ultimate' },
    { k: 'Current release', v: 'NCM 2.1 (Aug 2026)' },
    { k: 'NCM 2.x', v: '2.0 GA Apr 2026 · requires Nutanix Central on-premises' },
    { k: 'Small form factor (NCM 2.1)', v: '3 nodes, about 2,500 VMs' },
    { k: 'Medium form factor (NCM 2.0)', v: 'About 10,000 VMs' },
  ],
  qa: [
    {
      q: 'Does cost data go to a Nutanix cloud service?',
      a: 'Not in NCM 2.x. From NCM 2.0, Cost Governance runs fully on-premises inside your data center, without a separate SaaS application. Older Beam deployments were SaaS, so check which version you are comparing.',
    },
    {
      q: 'Does a budget stop the spending by itself?',
      a: 'Not as far as the published material says. Cost Governance budgets track spend and send overspend alerts, and its recommendations show what to stop or right-size; we found no budget setting that switches resources off. The hard limit is the Self-Service project quota, which caps the CPU, memory and storage a project can deploy, with approval and scheduler policies on NCM Ultimate.',
    },
    {
      q: 'Can it manage our VMware estate too?',
      a: 'NCM 2.x spans multiple Prism Centrals and VMware vCenters, and Intelligent Operations Starter lists ESXi on non-Nutanix infrastructure. Feature coverage differs between AHV and vCenter-managed environments, so map your use cases to the current feature matrix.',
    },
  ],
  next: [
    'On the AIOps tab, pause on the 3 a.m. spike, flagged by the learned band while the fixed 70% alarm stays silent, then on the 2 p.m. spike, which both catch.',
    'On the Self-Service tab, pick 3-tier web app for the approval step, then App over quota to show a request sent back before anything is created.',
    'On the Cost tab, pause on each numbered step (the alert, the recommendations, the quota and policies) and compare where the month ends with the Left alone line.',
    'On the Security tab, watch findings get fixed, then a setting changed by hand caught by the next scan.',
    'Then open Nutanix Central & Prism Federation to see where NCM 2.x runs.',
  ],
  then: ['central'],
};
