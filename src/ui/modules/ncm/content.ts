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
    'AIOps: instead of a fixed threshold, it learns normal per time of day. Move the spike to 3 a.m. and see it flagged; the same spike on a busy afternoon is not.',
    'Capacity runway: slide “add N VMs” and see which resource runs out first and when, so purchases are planned, not reactive.',
    'Self-Service: app teams order from a catalog; quotas and approval policy are checked before anything is created, and the result arrives with owner and categories set.',
    'Cost: showback per project at rates you choose, with budget alerts. In NCM 2.0 Cost Governance runs entirely on-premises.',
    'Tiers matter: Starter covers forecasting and right-sizing, Pro adds Cost Governance and Self-Service, Ultimate adds multi-VM blueprints, approvals and Security Compliance.',
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
      q: 'Can it manage our VMware estate too?',
      a: 'NCM 2.0 spans multiple Prism Centrals and VMware vCenters, and Intelligent Operations Starter lists ESXi on non-Nutanix infrastructure. Feature coverage differs between AHV and vCenter-managed environments, so map your use cases to the current feature matrix.',
    },
    {
      q: 'Which license do we need for the self-service portal?',
      a: 'NCM Pro gives the marketplace, single-VM blueprints and runbooks. Multi-VM application blueprints and approval workflows need NCM Ultimate.',
    },
  ],
  next: ['Nutanix Central & Prism Federation', 'Kubernetes Platform', 'Database Service'],
  honest: [
    'Anomaly detection and forecasts need history to learn from; expect a learning period before results are useful, and noisy alerts if the baseline is too tight.',
    'Self-service is only as good as the blueprints behind it; someone has to build, test and maintain them.',
    'Showback reflects the rates you set; it is a model of cost, not an invoice.',
    'NCM 2.x requires Nutanix Central on-premises, which is another component to deploy and size.',
  ],
};
