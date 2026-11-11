import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'ai',
  title: 'Enterprise AI',
  tag: 'Platform services',
  summary: 'Nutanix Enterprise AI (NAI) runs large language model (LLM) inference endpoints on Kubernetes you control, in your data center or public cloud, and its Agent Gateway governs how apps and agents reach models and tools.',
  priority: 'P2',
  talk: [
    'Overview tab, the whole product in one loop: every team wants AI on company data and finds its own way; NAI runs on Kubernetes you control; a model from its catalog becomes an endpoint with replicas on GPUs; apps call it and agents go through Agent Gateway; roles, sharing and monitoring govern it; every team ends up on one platform, licensed by GPU memory, not tokens.',
    'Most teams do not want to send sensitive prompts to a shared public service. NAI lets them run models on infrastructure they control.',
    'Pick where it runs: your data center (NKP on Nutanix), public cloud (EKS, AKS or GKE in your own account) or an air-gapped site, which means NKP in your data center with no internet and no Hugging Face.',
    'Each replica loads its own copy of the model onto its GPUs. Apps and agents call one endpoint address with an API token; role-based access control decides who creates endpoints and tokens, with GPU and model monitoring built in. A supported model can span several GPUs; spanning GPU nodes is a tech preview. Not every model needs a full GPU: from NAI 2.5 a replica can run on an NVIDIA MIG slice (or a vGPU), which suits embedding models and small language models.',
    'The endpoint spreads requests over the replicas. With one replica, requests queue in busy moments, and a stop for an update or a fault means a pause. With two or more, the others keep answering.',
    'Agent Gateway, licensed separately, gives apps one address for every model: your NAI endpoints, a remote NAI cluster or an external provider, with fallback and per-client rate limits (by request header in tech preview), and semantic routing by policy planned for NAI 2.10. Its Model Context Protocol (MCP) Gateway adds API keys, limits tool actions and logs every call.',
    'GPUs tab: GPUs are the scarce part, so show how NAI fits models onto them. Small models share one GPU as MIG slices and the spare slice goes to another workload; a model too big for one GPU spans several with tensor parallelism; a tech preview spans nodes; and hibernating an idle endpoint frees its GPUs while keeping its configuration.',
    'Faster answers tab: speculative decoding lets a small draft model guess tokens that the large model checks in one pass, up to 2.5x faster by Nutanix\u2019s figure. KV-cache offload, a tech preview, keeps a conversation\u2019s notes in host memory so its next answer starts fast.',
    'Models and data tab: fine-tune a model under 8B parameters on your own data with LoRA, share selected models with chosen teams under custom roles, and ground the Agent app\u2019s answers in your documents with citations.',
    'Naming: NAI is the product, now at 2.8. Nutanix Agentic AI is the wider full-stack solution around it, and GPT-in-a-Box is the earlier name for the bundle NAI was part of.',
  ],
  numbers: [
    { k: 'Current release', v: 'NAI 2.8 (Aug 2026)' },
    { k: 'Runs on', v: 'NKP or other CNCF Kubernetes; tested on EKS, AKS and GKE' },
    { k: 'Model sources', v: 'NVIDIA Inference Microservices (NIM), Hugging Face, your own files; a catalog of pre-validated models. Air-gapped sites use air-gapped NIM or your own files' },
    { k: 'Licensing', v: 'By GPU memory (vCPUs on clusters without GPUs), not tokens' },
    { k: 'Agent Gateway', v: 'Licensed separately · one unified endpoint for NAI endpoints, remote NAI clusters and external provider APIs · fallback · token rate limits, global or per client by API key (by request header in tech preview) · MCP Gateway (GA in 2.8) with API keys added at the gateway, tool permissions and audit logs' }, // AGW-1 to AGW-5
    { k: 'GPUs per replica', v: 'Whole GPUs, or an NVIDIA MIG slice (from NAI 2.5) or vGPU for models that do not need a full GPU' },
    { k: 'Semantic routing', v: 'Planned for NAI 2.10: Agent Gateway routes each request to a model by policy' },
    { k: 'Also in NAI 2.8', v: 'Multi-GPU serving by tensor parallelism (multi-node in tech preview), batch inference, speculative decoding, KV-cache offload (tech preview), endpoint hibernation (from 2.3), LoRA fine-tuning (GA for models under 8B), custom IAM roles and model sharing, document-grounded answers with citations, air-gapped NIM' }, // AI-1 to AI-10
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
    'Play the Overview first: the whole product in six scenes, from four teams each doing AI their own way to one governed platform.',
    'Then open Model endpoint: under Where it runs, keep Your data center and set Model replicas to 2: requests spread over both, then one stops and the other keeps answering.',
    'Set Model replicas to 1 to show the queue, and the pause when the only replica stops.',
    'Pick Air-gapped site under Where it runs: the model comes in as files, with no internet connection.',
    'Open the GPUs tab and pick Share a GPU: one small model wastes a whole GPU until MIG slices it. Then Span GPUs for a model too big for one GPU, and Hibernate to free GPUs without deleting an endpoint.',
    'Open Faster answers for speculative decoding, then Models and data for fine-tuning, roles and sharing, and grounded answers.',
    'Open the Agent Gateway tab: one address for every model, a fallback when the NAI endpoint fails, the looping coding agent capped, then a tool write blocked and logged.',
    'Then open Kubernetes Platform for what the endpoint runs on.',
  ],
  then: ['nkp'],
};
