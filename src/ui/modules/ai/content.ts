import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ai',
  title: 'Enterprise AI',
  tag: 'Platform services',
  summary: 'Nutanix Enterprise AI (NAI) deploys and runs large language model (LLM) inference endpoints on Kubernetes, in your data center or in public cloud, with your choice of model and secure API access for apps and agents.',
  priority: 'P2',
  talk: [
    'Most teams do not want to send sensitive prompts to a shared public service. NAI lets them run models on infrastructure they control.',
    'Pick where it runs: your data center (NKP on Nutanix), public cloud (EKS, AKS or GKE in your own account), or an air-gapped site. Air-gapped means NKP in your own data center: Hugging Face is out, and the model comes as air-gapped NIM or your own files.',
    'Every replica loads its own copy of the model onto its GPUs. Apps and agents call one endpoint address with an API token; role-based access control decides who can create endpoints and tokens, and GPU and model monitoring are built in.',
    'The endpoint spreads requests over the replicas. With one replica, requests queue in busy moments, and a stop for an update or a fault means a pause. With two or more, the others keep answering.',
    'NAI 2.8 adds the Agent Gateway in front of endpoints: token tracking and quotas per app, and an MCP Gateway for governed tool access by agents. It can also split a large model across several GPUs in one replica.',
    'Naming: NAI is the product, now at 2.8. Nutanix Agentic AI is the wider full-stack solution around it, and GPT-in-a-Box is the earlier name for the bundle NAI was part of.',
  ],
  numbers: [
    { k: 'Current release', v: 'NAI 2.8 (GA August 2026)' },
    { k: 'Runs on', v: 'NKP, plus EKS, AKS and GKE' },
    { k: 'Model sources', v: 'NVIDIA NIM, Hugging Face, your own' },
    { k: 'Pricing basis', v: 'Infrastructure resources, not tokens' },
    { k: 'Also in NAI 2.8', v: 'Agent Gateway with MCP Gateway, multi-GPU serving, batch inference, speculative decoding, LoRA fine-tuning (models under 8B), custom IAM roles, air-gapped NIM' },
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
  next: [
    'Start on your data center with 2 replicas: requests spread over both, then one stops and the other keeps answering.',
    'Switch to 1 replica to show the queue, and the pause when the only replica stops.',
    'Switch to the air-gapped site: the model comes in as files, with no internet connection.',
    'Then open the Kubernetes Platform module for what the endpoint runs on.',
  ],
  honest: [
    'GPUs are the real constraint: model size and traffic decide how many you need, and that sizing is a separate exercise from this picture.',
    'Some agentic AI pieces were early access in 2026; confirm what is GA for the features a project depends on.',
    'Running your own endpoints means your team operates them: capacity, model updates and access policies are yours to manage.',
  ],
};
