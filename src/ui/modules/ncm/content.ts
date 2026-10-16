import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ncm',
  title: 'Cloud Manager',
  tag: 'Nutanix Central',
  summary:
    'Nutanix Cloud Manager (NCM) adds operations on top of the platform: AIOps that learns what normal looks like, self-service provisioning under quotas, cost showback and budgets kept on-premises, and security compliance checks.',
  priority: 'P1',
  talk: [
    'Four parts: Intelligent Operations (AIOps), Self-Service (formerly Calm), Cost Governance (formerly Beam) and Security Compliance (formerly Security Central).',
    'AIOps: instead of a fixed threshold, it learns what normal looks like for each hour. A spike at 3 a.m. is flagged even though it stays under a 70% alarm that would miss it; a spike on a busy afternoon is flagged and trips the alarm too; normal busy afternoons raise nothing.',
    'Intelligent Operations also forecasts capacity runway, so purchases are planned rather than reactive, and suggests right-sizing for over- and under-sized VMs.',
    'Self-Service: app teams order from a catalog; quota and approval policy are checked before anything is created, and the result arrives with owner, project and categories set. Over quota, the request is sent back with the reason.',
    'Cost: dev-test runs hot. Cost Governance meters it daily at your rates, sends the owner an overspend alert against the budget while there is time to act, and lists the idle and oversized VMs to stop or right-size. Self-Service stops it coming back: the project quota caps what dev-test can deploy, and approval and scheduler policies hold big requests and stop dev-test apps at night. In NCM 2.0 Cost Governance runs entirely on-premises.',
    'Security Compliance scans settings against a baseline, suggests a fix for each finding, and catches drift when someone changes a setting by hand. Tiers matter: Starter covers forecasting and right-sizing, Pro adds Cost Governance and Self-Service, Ultimate adds multi-VM blueprints, approvals and Security Compliance.',
  ],
  numbers: [
    { k: 'NCM components', v: 'Intelligent Operations · Self-Service · Cost Governance · Security Compliance' },
    { k: 'Self-Service & Cost Governance', v: 'From NCM Pro' },
    { k: 'Security Compliance, multi-VM blueprints, approvals', v: 'NCM Ultimate' },
    { k: 'NCM 2.0', v: 'GA Apr 2026, runs in Nutanix Central on-prem' },
    { k: 'NCM 2.0 medium form factor', v: 'About 10,000 VMs' },
  ],
  qa: [
    {
      q: 'Does cost data go to a Nutanix cloud service?',
      a: 'Not in NCM 2.0. Cost Governance now runs fully on-premises inside your data center, without a separate SaaS application. Older Beam deployments were SaaS, so check which version you are comparing.',
    },
    {
      q: 'Does a budget stop the spending by itself?',
      a: 'Not as far as the published material says. Cost Governance budgets track spend and send overspend alerts, and its recommendations show what to stop or right-size; we found no budget setting that switches resources off. The hard limit is the Self-Service project quota, which caps the CPU, memory and storage a project can deploy, with approval and scheduler policies on NCM Ultimate.',
    },
    {
      q: 'Can it manage our VMware estate too?',
      a: 'NCM 2.0 spans multiple Prism Centrals and VMware vCenters, and Intelligent Operations Starter lists ESXi on non-Nutanix infrastructure. Feature coverage differs between AHV and vCenter-managed environments, so map your use cases to the current feature matrix.',
    },
    {
      q: 'Which license do we need for the self-service portal?',
      a: 'NCM Pro gives the marketplace, single-VM blueprints and runbooks. Multi-VM application blueprints and approval workflows need NCM Ultimate.',
    },
  ],
  next: [
    'AIOps: pause on the 3 a.m. spike, flagged by the learned band while the fixed 70% alarm stays silent, then on the 2 p.m. spike, which both catch.',
    'Self-Service: 3-tier web app for the approval step, then App over quota to show a request sent back before anything is created.',
    'Cost: pause on each numbered step (the alert, the recommendations, the quota and policies) and compare where the month ends with the left-alone line.',
    'SecOps: watch findings get fixed, then a setting changed by hand caught by the next scan.',
    'Then open Nutanix Central & Prism Federation, where NCM 2.x runs.',
  ],
};
