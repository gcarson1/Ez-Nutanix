// Flow Network Security policy evaluation (pure, deterministic, no DOM).
//
// Model (simplified, see the UI's "Illustrative" tags):
// - VMs carry categories (key:value pairs such as AppType:HR, AppTier:Web, Environment:Production).
//   Policies select VMs by category, never by IP address.
// - Three policy types: application (allow-list of inbound flows into an app's tiers; anything
//   not listed is denied), isolation (two groups that may never talk), quarantine (strict: no
//   traffic in or out; forensic: only listed forensic sources may reach the VM).
// - Precedence: quarantine, then isolation, then application policies.
// - Each applied policy is Monitoring (log what would be blocked, allow it) or Enforced. A Saved policy is defined but not applied (enabled: false).
// - Enforcement happens in the virtual switch of the host where the VM's vNIC lives, so when a
//   VM live-migrates the same verdict is produced on its new host.

export type Cats = Record<string, string>;
export type Mode = 'monitor' | 'enforce';

export interface FlowVm {
  id: string;
  name: string;
  cats: Cats;
  host: string;
  ip: string;
}

/** A category selector: every listed key must match. An empty selector matches nothing. */
export type Sel = Cats;

export interface AppRule {
  id: string;
  /** Source: 'any' (any source, including outside the cluster), or a category selector. */
  from: 'any' | Sel;
  /** Destination tier inside the app (value of AppTier). */
  toTier: string;
  /** Allowed TCP port; 0 means any port. */
  port: number;
}

export interface AppPolicy {
  id: string;
  type: 'app';
  name: string;
  mode: Mode;
  enabled: boolean;
  /** Which VMs this application policy protects (for example AppType:HR + Environment:Production). */
  target: Sel;
  rules: AppRule[];
  /** Allow traffic between VMs of the same tier (off by default in this model). */
  intraTier: boolean;
}

export interface IsolationPolicy {
  id: string;
  type: 'isolation';
  name: string;
  mode: Mode;
  enabled: boolean;
  a: Sel;
  b: Sel;
}

export interface QuarantineState {
  /** VM id -> quarantine kind. */
  vms: Record<string, 'strict' | 'forensic'>;
  /** Sources allowed to reach a forensic-quarantined VM. */
  forensicFrom: Sel;
}

export interface Policies {
  apps: AppPolicy[];
  isolations: IsolationPolicy[];
  quarantine: QuarantineState;
}

export interface Packet {
  /** Source VM id, or 'external' for a client outside the cluster. */
  src: string;
  dst: string;
  port: number;
}

export type HitAction = 'allow' | 'deny' | 'would-deny';

export interface Hit {
  policy: string;
  kind: 'quarantine' | 'isolation' | 'app' | 'none';
  rule: string;
  action: HitAction;
}

export interface Verdict {
  allowed: boolean;
  /** True when a policy in Monitoring would have blocked this packet. */
  wouldDrop: boolean;
  hits: Hit[];
  /** Host whose virtual switch made the decision (empty for external-only flows). */
  at: string;
  /** VM whose vNIC enforced it. */
  atVm: string;
  reason: string;
}

export function matches(cats: Cats | undefined, sel: Sel): boolean {
  if (!cats) return false;
  const keys = Object.keys(sel);
  if (keys.length === 0) return false;
  return keys.every((k) => cats[k] === sel[k]);
}

export function selLabel(sel: 'any' | Sel): string {
  if (sel === 'any') return 'Any source';
  return Object.entries(sel)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' + ');
}

function vmById(vms: FlowVm[], id: string): FlowVm | undefined {
  return vms.find((v) => v.id === id);
}

/** Evaluate one packet against all policies. */
export function evaluate(pkt: Packet, vms: FlowVm[], pol: Policies): Verdict {
  const src = pkt.src === 'external' ? undefined : vmById(vms, pkt.src);
  const dst = vmById(vms, pkt.dst);
  const hits: Hit[] = [];
  let wouldDrop = false;
  const srcName = src ? src.name : 'External client';
  const dstName = dst ? dst.name : pkt.dst;

  const drop = (at: FlowVm | undefined, reason: string): Verdict => ({
    allowed: false,
    wouldDrop,
    hits,
    at: at?.host ?? '',
    atVm: at?.id ?? '',
    reason,
  });

  if (!dst) return drop(undefined, 'Unknown destination.');

  // 1. Quarantine (source side, then destination side). Always enforced.
  const qs = src ? pol.quarantine.vms[src.id] : undefined;
  if (src && qs) {
    hits.push({ policy: 'Quarantine', kind: 'quarantine', rule: `${src.name} is quarantined (${qs})`, action: 'deny' });
    return drop(src, `${src.name} is quarantined: it cannot send traffic.`);
  }
  const qd = pol.quarantine.vms[dst.id];
  if (qd) {
    if (qd === 'forensic' && src && matches(src.cats, pol.quarantine.forensicFrom)) {
      hits.push({ policy: 'Quarantine', kind: 'quarantine', rule: `Forensic access from ${selLabel(pol.quarantine.forensicFrom)}`, action: 'allow' });
      return { allowed: true, wouldDrop, hits, at: dst.host, atVm: dst.id, reason: `Forensic quarantine lets ${srcName} inspect ${dstName}.` };
    }
    hits.push({ policy: 'Quarantine', kind: 'quarantine', rule: `${dst.name} is quarantined (${qd})`, action: 'deny' });
    return drop(dst, `${dst.name} is quarantined: inbound traffic is blocked.`);
  }

  // 2. Isolation policies (either direction).
  for (const iso of pol.isolations) {
    if (!iso.enabled || !src) continue;
    const crosses = (matches(src.cats, iso.a) && matches(dst.cats, iso.b)) || (matches(src.cats, iso.b) && matches(dst.cats, iso.a));
    if (!crosses) continue;
    const rule = `${selLabel(iso.a)} ⟷ ${selLabel(iso.b)} never talk`;
    if (iso.mode === 'enforce') {
      hits.push({ policy: iso.name, kind: 'isolation', rule, action: 'deny' });
      return drop(src, `Isolation policy "${iso.name}" blocks traffic between these environments.`);
    }
    hits.push({ policy: iso.name, kind: 'isolation', rule, action: 'would-deny' });
    wouldDrop = true;
  }

  // 3. Application policies protecting the destination (inbound allow-list, default deny).
  for (const app of pol.apps) {
    if (!app.enabled || !matches(dst.cats, app.target)) continue;
    const tier = dst.cats.AppTier;
    const sameApp = src && matches(src.cats, app.target);
    if (sameApp && app.intraTier && src!.cats.AppTier === tier) {
      hits.push({ policy: app.name, kind: 'app', rule: `Within tier ${tier}`, action: 'allow' });
      continue;
    }
    const rule = app.rules.find((r) => r.toTier === tier && (r.port === 0 || r.port === pkt.port) && (r.from === 'any' || (src ? matches(src.cats, r.from) : false)));
    if (rule) {
      hits.push({ policy: app.name, kind: 'app', rule: `${selLabel(rule.from)} → ${tier} : ${rule.port || 'any'}`, action: 'allow' });
      continue;
    }
    const dr = `No rule allows ${srcName} → ${tier} on port ${pkt.port} (default deny)`;
    if (app.mode === 'enforce') {
      hits.push({ policy: app.name, kind: 'app', rule: dr, action: 'deny' });
      return drop(dst, `Application policy "${app.name}" has no rule for this flow, so it is denied by default.`);
    }
    hits.push({ policy: app.name, kind: 'app', rule: dr, action: 'would-deny' });
    wouldDrop = true;
  }

  if (hits.length === 0) hits.push({ policy: '—', kind: 'none', rule: 'No policy applies to this flow', action: 'allow' });
  return {
    allowed: true,
    wouldDrop,
    hits,
    at: dst.host,
    atVm: dst.id,
    reason: wouldDrop ? 'Allowed, but a policy in Monitoring logged that it would block this flow.' : hits[0].kind === 'none' ? 'No policy covers these VMs, so traffic flows freely.' : 'Allowed by policy.',
  };
}

/** Live-migrate a VM: only its host changes; its categories (and so its policies) go with it. */
export function migrateVm(vms: FlowVm[], id: string, host: string): FlowVm[] {
  return vms.map((v) => (v.id === id ? { ...v, host } : v));
}

export function setQuarantine(q: QuarantineState, id: string, kind: 'strict' | 'forensic' | null): QuarantineState {
  const vmsQ = { ...q.vms };
  if (kind) vmsQ[id] = kind;
  else delete vmsQ[id];
  return { ...q, vms: vmsQ };
}

// ── lateral movement (ransomware) ──

export interface SpreadEvent {
  wave: number;
  src: string;
  dst: string;
  port: number;
  verdict: Verdict;
  /** True when this attempt infected a new VM. */
  infects: boolean;
}

export interface SpreadResult {
  events: SpreadEvent[];
  infected: string[];
}

/**
 * Breadth-first lateral movement from one or more infected VMs: every infected VM tries every other VM on each attack port.
 * An allowed attempt infects the target, which joins the next wave. Deterministic order.
 */
export function simulateSpread(vms: FlowVm[], pol: Policies, patientZero: string | string[], ports: number[], maxWaves = 3): SpreadResult {
  const start = Array.isArray(patientZero) ? patientZero : [patientZero];
  const infected = new Set<string>(start);
  const events: SpreadEvent[] = [];
  let frontier = [...start];
  for (let wave = 1; wave <= maxWaves && frontier.length; wave++) {
    const next: string[] = [];
    for (const s of frontier) {
      for (const d of vms) {
        if (d.id === s) continue;
        for (const port of ports) {
          const verdict = evaluate({ src: s, dst: d.id, port }, vms, pol);
          const infects = verdict.allowed && !infected.has(d.id);
          if (infects) {
            infected.add(d.id);
            next.push(d.id);
          }
          if (!infected.has(d.id) || infects || !verdict.allowed) events.push({ wave, src: s, dst: d.id, port, verdict, infects });
        }
      }
    }
    frontier = next;
  }
  return { events, infected: [...infected] };
}
