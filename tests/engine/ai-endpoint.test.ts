import { describe, it, expect } from 'vitest';
import { airgapBlocked, architecture, normalize, sourceBlocked, type EndpointChoice } from '../../src/engine/ai-endpoint';

const base: EndpointChoice = { target: 'nkp', source: 'nim', gpus: 1, replicas: 1, gateway: false, airgap: false };

describe('NAI endpoint wizard', () => {
  it('air-gapped only applies to your own data center', () => {
    expect(airgapBlocked({ target: 'nkp' })).toBeNull();
    for (const target of ['eks', 'aks', 'gke'] as const) {
      expect(airgapBlocked({ target })).toBeTruthy();
      expect(normalize({ ...base, target, airgap: true }).airgap).toBe(false);
    }
  });

  it('Hugging Face is unavailable when air-gapped, and normalize never returns a blocked combination', () => {
    expect(sourceBlocked('hf', { airgap: true })).toBeTruthy();
    const n = normalize({ ...base, airgap: true, source: 'hf' });
    expect(sourceBlocked(n.source, n)).toBeNull();
    expect(n.source).toBe('upload');
  });

  it('counts GPUs and flags tensor-parallel serving', () => {
    const a = architecture({ ...base, gpus: 4, replicas: 2 });
    expect(a.totalGpus).toBe(8);
    expect(a.tensorParallel).toBe(true);
    expect(architecture(base).tensorParallel).toBe(false);
    expect(architecture({ ...base, replicas: 9 }).choice.replicas).toBe(3);
  });

  it('keeps on-prem and cloud straight', () => {
    expect(architecture(base).onPrem).toBe(true);
    expect(architecture({ ...base, target: 'eks' }).onPrem).toBe(false);
  });
});
