// Enterprise AI (NAI) "deploy a model endpoint" wizard: choices in, a validated architecture out.
// Pure. Facts behind the options are in docs/research/E-platform-services.md (row 7a).

export type Target = 'nkp' | 'eks' | 'aks' | 'gke';
export type Source = 'nim' | 'hf' | 'upload';

export interface EndpointChoice {
  target: Target;
  source: Source;
  /** GPUs per replica. More than one means the model is split across GPUs (tensor parallel). */
  gpus: 1 | 2 | 4;
  replicas: number;
  /** Put the Agent Gateway (with its MCP Gateway) in front of the endpoint. */
  gateway: boolean;
  /** Site has no internet connection. */
  airgap: boolean;
}

export const TARGET_LABEL: Record<Target, string> = {
  nkp: 'NKP on Nutanix Cloud Infrastructure',
  eks: 'Amazon EKS',
  aks: 'Azure AKS',
  gke: 'Google GKE',
};

export const SOURCE_LABEL: Record<Source, string> = {
  nim: 'NVIDIA NIM',
  hf: 'Hugging Face',
  upload: 'Your own model (upload)',
};

/** Why a choice is not available given the others, or null if it is. */
export function airgapBlocked(c: Pick<EndpointChoice, 'target'>): string | null {
  return c.target === 'nkp' ? null : 'Air-gapped means no outside connection, so it applies to your own data center (NKP on NCI), not a hyperscaler.';
}

export function sourceBlocked(s: Source, c: Pick<EndpointChoice, 'airgap'>): string | null {
  if (s === 'hf' && c.airgap) return 'Pulling a model from Hugging Face needs internet access. In an air-gapped site, upload the model files or use NIM in air-gapped mode.';
  return null;
}

/** Normalize: drop any combination the UI would show as unavailable. */
export function normalize(c: EndpointChoice): EndpointChoice {
  const out = { ...c, replicas: Math.max(1, Math.min(3, Math.round(c.replicas))) };
  if (airgapBlocked(out)) out.airgap = false;
  if (sourceBlocked(out.source, out)) out.source = 'upload';
  return out;
}

export interface Architecture {
  choice: EndpointChoice;
  totalGpus: number;
  tensorParallel: boolean;
  onPrem: boolean;
  /** Plain-English lines describing the result, in reading order. */
  notes: string[];
}

export function architecture(input: EndpointChoice): Architecture {
  const c = normalize(input);
  const onPrem = c.target === 'nkp';
  const notes: string[] = [];
  notes.push(
    onPrem
      ? 'The endpoint runs on Kubernetes in your own data center, so prompts, responses and model files stay on your infrastructure.'
      : `The endpoint runs on ${TARGET_LABEL[c.target]} in your cloud account, in the region you choose.`,
  );
  notes.push(
    c.source === 'nim'
      ? 'The model comes as an NVIDIA NIM package, tuned for NVIDIA GPUs.'
      : c.source === 'hf'
        ? 'The model is pulled from Hugging Face when the endpoint is created.'
        : 'You upload the model files yourself, so nothing is downloaded from outside.',
  );
  if (c.gpus > 1) notes.push(`Each replica splits the model across ${c.gpus} GPUs (tensor-parallel serving), for models too large for one GPU.`);
  if (c.replicas > 1) notes.push(`${c.replicas} replicas share the traffic, so one replica can fail or be updated while the others keep serving.`);
  notes.push('Apps call the endpoint over HTTPS with an API token. Role-based access control decides who can create endpoints and tokens.');
  if (c.gateway) notes.push('The Agent Gateway sits in front: it tracks tokens and enforces quotas per app, and its MCP Gateway gives agents governed access to tools.');
  if (c.airgap) notes.push('Air-gapped: once the model files are inside the site, the endpoint runs with no internet connection.');
  return { choice: c, totalGpus: c.gpus * c.replicas, tensorParallel: c.gpus > 1, onPrem, notes };
}
