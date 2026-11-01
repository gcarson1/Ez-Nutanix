import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ai',
  title: 'Enterprise AI',
  tag: 'Platform services',
  summary: 'Nutanix Enterprise AI (NAI) runs large language model (LLM) inference endpoints on Kubernetes you control, in your data center or public cloud, with your choice of model and secure API access for apps and agents.',
  priority: 'P2',
  talk: [
    'Most teams do not want to send sensitive prompts to a shared public service. NAI lets them run models on infrastructure they control.',
    'Pick where it runs: your data center (NKP on Nutanix), public cloud (EKS, AKS or GKE in your own account) or an air-gapped site, which means NKP in your data center with no internet and no Hugging Face.',
    'Each replica loads its own copy of the model onto its GPUs. Apps and agents call one endpoint address with an API token; role-based access control decides who creates endpoints and tokens, with GPU and model monitoring built in.',
    'The endpoint spreads requests over the replicas. With one replica, requests queue in busy moments, and a stop for an update or a fault means a pause. With two or more, the others keep answering.',
    'NAI 2.8 adds an Agent Gateway in front of endpoints, with token quotas per app and a Model Context Protocol (MCP) Gateway for governed tool access. A supported model can span several GPUs; spanning GPU nodes is a tech preview.',
    'Naming: NAI is the product, now at 2.8. Nutanix Agentic AI is the wider full-stack solution around it, and GPT-in-a-Box is the earlier name for the bundle NAI was part of.',
  ],
  numbers: [
    { k: 'Current release', v: 'NAI 2.8 (Aug 2026)' },
    { k: 'Runs on', v: 'NKP or other CNCF Kubernetes; tested on EKS, AKS and GKE' },
    { k: 'Model sources', v: 'NVIDIA Inference Microservices (NIM), Hugging Face, your own files; a catalog of pre-validated models. Air-gapped sites use air-gapped NIM or your own files' },
    { k: 'Licensing', v: 'By GPU memory (vCPUs on clusters without GPUs), not tokens' },
    { k: 'Also in NAI 2.8', v: 'Agent Gateway (licensed separately) with MCP Gateway, multi-GPU serving (multi-node in tech preview), batch inference, speculative decoding, LoRA fine-tuning (models under 8B), custom IAM roles, air-gapped NIM' },
  ],
  qa: [
    {
      q: 'Does our data leave our site?',
      a: 'Not when the endpoint runs on NKP in your data center: prompts, responses and model files stay on your infrastructure, and it can run fully air-gapped. In public cloud it runs in your own account and region.',
    },
    {
      q: 'Which models can we run?',
      a: 'NVIDIA NIM packages (with an NVIDIA AI Enterprise license), models from Hugging Face or model files you upload. NAI keeps a catalog of pre-validated models; others you import yourself. Fit depends on GPU memory; NAI 2.8 can split supported models across several GPUs.',
    },
    {
      q: 'Is Nutanix Agentic AI a separate product we buy?',
      a: 'It is a full-stack solution rather than one product: NAI plus NKP, AHV, Flow and Nutanix Unified Storage, integrated with NVIDIA AI Enterprise. Some parts are GA and some were early access, with the full solution targeted for the second half of 2026.',
    },
  ],
  next: [
    'Under Where it runs, keep Your data center and set Model replicas to 2: requests spread over both, then one stops and the other keeps answering.',
    'Set Model replicas to 1 to show the queue, and the pause when the only replica stops.',
    'Pick Air-gapped site under Where it runs: the model comes in as files, with no internet connection.',
    'Then open Kubernetes Platform for what the endpoint runs on.',
  ],
  then: ['nkp'],
};
