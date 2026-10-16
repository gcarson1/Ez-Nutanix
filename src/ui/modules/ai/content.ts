import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ai',
  title: 'Enterprise AI',
  tag: 'Platform services',
  summary: 'Nutanix Enterprise AI (NAI) deploys and runs large language model (LLM) inference endpoints on Kubernetes, in your data center or in public cloud, with your choice of model and secure API access for apps and agents.',
  priority: 'P2',
  talk: [
    'Most teams do not want to send sensitive prompts to a shared public service. NAI lets them run models on infrastructure they control.',
    'Walk the wizard: pick the Kubernetes cluster (NKP on-premises, or EKS, AKS, GKE), the model source (NVIDIA NIM, Hugging Face, or upload your own), the GPUs and replicas, then access.',
    'The result is an inference endpoint that apps call with an API token, with role-based access, and GPU and model monitoring built in.',
    'Turn on the Agent Gateway to show the 2026 story: token tracking and quotas per app, and an MCP Gateway for governed tool access by agents.',
    'Switch to air-gapped: Hugging Face is no longer an option, and everything runs with no internet connection once the model files are inside.',
    'Naming: NAI is the product, now at 2.8. Nutanix Agentic AI is the wider full-stack solution around it.',
  ],
  numbers: [
    { k: 'Current release', v: 'NAI 2.8 (GA August 2026)' },
    { k: 'Runs on', v: 'NKP, plus EKS, AKS and GKE' },
    { k: 'Model sources', v: 'NVIDIA NIM, Hugging Face, your own' },
    { k: 'Pricing basis', v: 'Infrastructure resources, not tokens' },
  ],
  qa: [
    {
      q: 'Does our data leave our site?',
      a: 'Not when the endpoint runs on NKP in your data center: prompts, responses and model files stay on your infrastructure, and it can run fully air-gapped. In public cloud it runs in your own account and region.',
    },
    {
      q: 'Which models can we run?',
      a: 'NVIDIA NIM packages, models from Hugging Face, or model files you upload. Fit depends on GPU memory; NAI 2.8 can split a model across several GPUs.',
    },
    {
      q: 'Is Nutanix Agentic AI a separate product we buy?',
      a: 'It is a full-stack solution rather than one product: NAI plus NKP, AHV, Flow and Nutanix Unified Storage, integrated with NVIDIA AI Enterprise. Some parts are GA and some were early access, with the full solution targeted for the second half of 2026.',
    },
  ],
  next: ['Kubernetes Platform', 'Files, Objects', 'Data Lens'],
  honest: [
    'GPUs are the real constraint: model size and traffic decide how many you need, and that sizing is a separate exercise from this wizard.',
    'Some agentic AI pieces were early access in 2026; confirm what is GA for the features a project depends on.',
    'Running your own endpoints means your team operates them: capacity, model updates and access policies are yours to manage.',
  ],
};
