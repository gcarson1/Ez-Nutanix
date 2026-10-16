// Flow Network Security: category-based microsegmentation with a policy builder, a traffic
// simulator with a rule-hit log, a ransomware lateral-movement scenario and live migration.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Field, Follow, Illus, PlayBar, Seg, Stat, Tip, Toggle } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { prefersReducedMotion, useClock } from '../../components/clock';
import { useBool, useEnum, useNum, useStr } from '../../../state/route';
import {
  evaluate,
  migrateVm,
  simulateSpread,
  type AppRule,
  type FlowVm,
  type Packet,
  type Policies,
  type Verdict,
} from '../../../engine/flow';

const TIERS = ['Web', 'App', 'DB'] as const;
type TierName = (typeof TIERS)[number];
const PORTS = [443, 8080, 5432, 22, 445, 3389];
const PORT_NAME: Record<number, string> = { 443: 'HTTPS', 8080: 'App API', 5432: 'PostgreSQL', 22: 'SSH', 445: 'SMB file sharing', 3389: 'Remote desktop' };
const HOSTS = ['h1', 'h2', 'h3'];
const HOST_NAME: Record<string, string> = { h1: 'Host 1', h2: 'Host 2', h3: 'Host 3' };
const ATTACK_PORTS = [445, 3389, 22];

const BASE_VMS: FlowVm[] = [
  { id: 'pweb1', name: 'HR-Web-1', cats: { AppType: 'HR', AppTier: 'Web', Environment: 'Production' }, host: 'h1', ip: '10.10.1.11' },
  { id: 'pweb2', name: 'HR-Web-2', cats: { AppType: 'HR', AppTier: 'Web', Environment: 'Production' }, host: 'h2', ip: '10.10.1.12' },
  { id: 'papp', name: 'HR-App-1', cats: { AppType: 'HR', AppTier: 'App', Environment: 'Production' }, host: 'h2', ip: '10.10.2.21' },
  { id: 'pdb', name: 'HR-DB-1', cats: { AppType: 'HR', AppTier: 'DB', Environment: 'Production' }, host: 'h3', ip: '10.10.3.31' },
  { id: 'dweb', name: 'HR-Web-Dev', cats: { AppType: 'HR', AppTier: 'Web', Environment: 'Dev' }, host: 'h1', ip: '10.20.1.11' },
  { id: 'dapp', name: 'HR-App-Dev', cats: { AppType: 'HR', AppTier: 'App', Environment: 'Dev' }, host: 'h3', ip: '10.20.2.21' },
  { id: 'ddb', name: 'HR-DB-Dev', cats: { AppType: 'HR', AppTier: 'DB', Environment: 'Dev' }, host: 'h2', ip: '10.20.3.31' },
  { id: 'sec', name: 'SecOps-Tools', cats: { AppType: 'Forensics' }, host: 'h3', ip: '10.30.0.5' },
];

// Diagram geometry (viewBox units).
const VW = 900;
const VH = 392;
const BOX_W = 196;
const BOX_H = 52;
const COL_X: Record<TierName, number> = { Web: 184, App: 424, DB: 664 };
const POS: Record<string, { x: number; y: number }> = {
  external: { x: 14, y: 116 },
  sec: { x: 14, y: 290 },
  pweb1: { x: COL_X.Web, y: 62 },
  pweb2: { x: COL_X.Web, y: 136 },
  papp: { x: COL_X.App, y: 99 },
  pdb: { x: COL_X.DB, y: 99 },
  dweb: { x: COL_X.Web, y: 290 },
  dapp: { x: COL_X.App, y: 290 },
  ddb: { x: COL_X.DB, y: 290 },
};
const EXT_W = 136;

function center(id: string) {
  const p = POS[id];
  const w = id === 'external' || id === 'sec' ? EXT_W : BOX_W;
  return { x: p.x + w / 2, y: p.y + BOX_H / 2 };
}

// ── URL encoding of the rule list ──
const DEFAULT_RULES = 'any-Web-443.Web-App-8080.App-DB-5432';
function parseRules(s: string): AppRule[] {
  const out: AppRule[] = [];
  s.split('.').forEach((part, i) => {
    const [from, to, port] = part.split('-');
    if (!TIERS.includes(to as TierName)) return;
    if (from !== 'any' && !TIERS.includes(from as TierName)) return;
    const p = Number(port);
    if (!Number.isFinite(p)) return;
    out.push({ id: `r${i}`, from: from === 'any' ? 'any' : { AppType: 'HR', Environment: 'Production', AppTier: from }, toTier: to, port: p });
  });
  return out;
}
function encodeRules(rules: AppRule[]): string {
  return rules.map((r) => `${r.from === 'any' ? 'any' : r.from.AppTier}-${r.toTier}-${r.port}`).join('.');
}
function parseMap(s: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const part of s.split('.')) {
    const [k, v] = part.split(':');
    if (k && v) m[k] = v;
  }
  return m;
}
function encodeMap(m: Record<string, string>): string {
  return Object.entries(m)
    .map(([k, v]) => `${k}:${v}`)
    .join('.');
}

type PolMode = 'off' | 'monitor' | 'enforce';
const MODE_OPTS = [
  { value: 'off' as PolMode, label: 'Saved' },
  { value: 'monitor' as PolMode, label: 'Monitoring' },
  { value: 'enforce' as PolMode, label: 'Enforced' },
];
const MODE_WORD: Record<PolMode, string> = { off: 'saved, not applied', monitor: 'monitoring', enforce: 'enforced' };

interface LogItem {
  id: number;
  t: number;
  pkt: Packet;
  v: Verdict;
  note?: string;
}

function nameOf(vms: FlowVm[], id: string) {
  return id === 'external' ? 'External client' : vms.find((v) => v.id === id)?.name ?? id;
}

function verdictTone(v: Verdict): 'ok' | 'warn' | 'bad' {
  return !v.allowed ? 'bad' : v.wouldDrop ? 'warn' : 'ok';
}
function verdictWord(v: Verdict): string {
  return !v.allowed ? 'Dropped' : v.wouldDrop ? 'Allowed (would drop)' : 'Allowed';
}

export function NetSec() {
  const [sc, setSc] = useEnum('sc', 'sim', ['sim', 'ran'] as const);
  const [am, setAm] = useEnum<PolMode>('am', 'monitor', ['off', 'monitor', 'enforce']);
  const [im, setIm] = useEnum<PolMode>('im', 'monitor', ['off', 'monitor', 'enforce']);
  const [intra, setIntra] = useBool('it', false);
  const [ar, setAr] = useStr('ar', DEFAULT_RULES);
  const [qs, setQs] = useStr('q', '');
  const [mvs, setMvs] = useStr('mv', '');
  const [ps, setPs] = useStr('ps', 'pweb1');
  const [pd, setPd] = useStr('pd', 'pdb');
  const [pp, setPp] = useNum('pp', 5432);
  const [xp, setXp] = useBool('xp', false);
  const [sel, setSel] = useState<string>('pdb');
  const [newFrom, setNewFrom] = useState<string>('Web');
  const [newTo, setNewTo] = useState<TierName>('DB');
  const [newPort, setNewPort] = useState<number>(5432);

  const rules = useMemo(() => parseRules(ar), [ar]);
  const quarantine = parseMap(qs) as Record<string, 'strict' | 'forensic'>;
  const moves = parseMap(mvs);
  const vms = useMemo(() => {
    let v = BASE_VMS;
    for (const [id, h] of Object.entries(moves)) if (HOSTS.includes(h)) v = migrateVm(v, id, h);
    return v;
  }, [mvs]);

  const pol: Policies = useMemo(
    () => ({
      apps: [
        {
          id: 'hr',
          type: 'app',
          name: 'HR (Production)',
          mode: am === 'enforce' ? 'enforce' : 'monitor',
          enabled: am !== 'off',
          target: { AppType: 'HR', Environment: 'Production' },
          rules,
          intraTier: intra,
        },
      ],
      isolations: [{ id: 'iso', type: 'isolation', name: 'Production ⟷ Dev', mode: im === 'enforce' ? 'enforce' : 'monitor', enabled: im !== 'off', a: { Environment: 'Production' }, b: { Environment: 'Dev' } }],
      quarantine: { vms: quarantine, forensicFrom: { AppType: 'Forensics' } },
    }),
    [am, im, intra, ar, qs],
  );

  // ── ransomware timeline ──
  const [qAt, setQAt] = useState<number | null>(null);
  const STEP = 0.45;
  const ran = useMemo(() => {
    const ports = xp ? [...ATTACK_PORTS, 8080, 5432] : ATTACK_PORTS;
    const first = simulateSpread(vms, pol, 'pweb1', ports);
    type Ev = (typeof first.events)[number] & { time: number };
    const timed: Ev[] = first.events.map((e, i) => ({ ...e, time: 0.6 + i * STEP }));
    let events = timed;
    let qIds: string[] = [];
    if (qAt !== null) {
      const before = timed.filter((e) => e.time < qAt);
      const inf = new Set<string>(['pweb1']);
      for (const e of before) if (e.infects && e.time + 0.4 <= qAt) inf.add(e.dst);
      qIds = [...inf];
      const qPol: Policies = { ...pol, quarantine: { ...pol.quarantine, vms: { ...pol.quarantine.vms, ...Object.fromEntries(qIds.map((id) => [id, 'strict' as const])) } } };
      const after = simulateSpread(vms, qPol, qIds, ports).events.map((e, i) => ({ ...e, time: qAt + 0.3 + i * STEP }));
      events = [...before.filter((e) => e.time + 0.4 <= qAt || !e.infects), ...after];
    }
    const duration = (events.length ? events[events.length - 1].time : 0) + 1.6;
    return { events, duration, qIds };
  }, [vms, pol, xp, qAt]);

  const clock = useClock({ rate: 1, stepSize: 0.45, keys: true, duration: sc === 'ran' ? ran.duration : undefined });
  const reduced = prefersReducedMotion();

  useEffect(() => {
    setQAt(null);
  }, [am, im, intra, ar, xp, sc, mvs, qs]);
  useEffect(() => {
    clock.reset();
    setLog([]);
    setPkts([]);
  }, [sc]);

  // ── free-play packets ──
  const [pkts, setPkts] = useState<LogItem[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [seq, setSeq] = useState(1);
  const send = (pkt: Packet, note?: string) => {
    const v = evaluate(pkt, vms, pol);
    const item: LogItem = { id: seq, t: clock.t, pkt, v, note };
    setSeq(seq + 1);
    setPkts((p) => [...p.filter((x) => clock.t - x.t < 2.5), item].slice(-6));
    setLog((l) => [item, ...l].slice(0, 40));
    if (!clock.playing) clock.play();
  };
  useEffect(() => {
    if (sc !== 'sim' || !clock.playing) return;
    const last = pkts[pkts.length - 1];
    if (!last || clock.t - last.t > 2.6) clock.pause();
  }, [clock.t, sc]);

  const lastPkt = log[0];

  // ── state for drawing ──
  const t = clock.t;
  const infected = new Set<string>();
  const ranVisible = sc === 'ran' ? ran.events.filter((e) => e.time <= t) : [];
  if (sc === 'ran') {
    infected.add('pweb1');
    for (const e of ranVisible) if (e.infects && e.time + 0.4 <= t) infected.add(e.dst);
  }
  const ranQ = sc === 'ran' && qAt !== null && t >= qAt ? new Set(ran.qIds) : new Set<string>();

  type Shot = { key: string; src: string; dst: string; prog: number; v: Verdict; age: number };
  const shots: Shot[] = [];
  const DUR = 1;
  if (sc === 'sim') {
    for (const p of pkts) {
      const age = t - p.t;
      if (age < 0 || age > 2.5) continue;
      shots.push({ key: `p${p.id}`, src: p.pkt.src, dst: p.pkt.dst, prog: reduced ? 1 : Math.min(1, age / DUR), v: p.v, age });
    }
  } else {
    ran.events.forEach((e, i) => {
      const age = t - e.time;
      if (age < 0 || age > 1.2) return;
      shots.push({ key: `r${i}`, src: e.src, dst: e.dst, prog: reduced ? 1 : Math.min(1, age / 0.5), v: e.verdict, age });
    });
  }

  const selVm = vms.find((v) => v.id === sel);

  const setRuleList = (r: AppRule[]) => setAr(encodeRules(r) || 'none-none-0');
  const addRule = () => {
    const exists = rules.some((r) => (r.from === 'any' ? 'any' : r.from.AppTier) === newFrom && r.toTier === newTo && r.port === newPort);
    if (exists) return;
    setRuleList([...rules, { id: 'n', from: newFrom === 'any' ? 'any' : { AppType: 'HR', Environment: 'Production', AppTier: newFrom }, toTier: newTo, port: newPort }]);
  };

  const ranStats = {
    attempts: ranVisible.length,
    blocked: ranVisible.filter((e) => !e.verdict.allowed).length,
    would: ranVisible.filter((e) => e.verdict.allowed && e.verdict.wouldDrop).length,
  };
  const ranDone = sc === 'ran' && t >= ran.duration - 1e-6;

  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Application policy" tip="Protects the HR app in Production (AppType: HR + Environment: Production). Only the inbound flows listed below are allowed; anything else into the app is denied by default."
          detail="Policy states: Saved (defined but not applied), Monitoring (everything is allowed, and flows the policy would block are logged), Enforced (rules are applied). Other policy types not shown here: Shared Services and VDI (rules based on Active Directory groups)."
          value={MODE_WORD[am]}
        >
          <Seg label="Application policy mode" value={am} options={MODE_OPTS} onChange={setAm} />
        </Field>
        <Field
          label="Allowed inbound flows"
          tip="Each rule names a source and a destination tier by category, plus a port. There are no IP addresses in the policy."
          note={
            <span>
              Everything else into the app: <b>denied by default</b>.
            </span>
          }
        >
          <ul class="fl-rules">
            {rules.map((r, i) => (
              <li key={`${encodeRules([r])}`}>
                <span class="mono">
                  {r.from === 'any' ? 'Any' : r.from.AppTier} → {r.toTier} :{r.port}
                </span>
                <button type="button" class="tbtn" aria-label={`Remove rule ${i + 1}`} onClick={() => setRuleList(rules.filter((_, j) => j !== i))}>
                  <Icon name="x" />
                </button>
              </li>
            ))}
            {rules.length === 0 && <li class="muted">No rules: nothing may enter the app.</li>}
          </ul>
          <div class="fl-add">
            <select class="input" aria-label="New rule source" value={newFrom} onChange={(e) => setNewFrom((e.target as HTMLSelectElement).value)}>
              <option value="any">Any</option>
              {TIERS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <span aria-hidden="true">→</span>
            <select class="input" aria-label="New rule destination tier" value={newTo} onChange={(e) => setNewTo((e.target as HTMLSelectElement).value as TierName)}>
              {TIERS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <select class="input" aria-label="New rule port" value={newPort} onChange={(e) => setNewPort(Number((e.target as HTMLSelectElement).value))}>
              {PORTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button type="button" class="btn" onClick={addRule}>
              <Icon name="plus" />
              Add
            </button>
          </div>
          {ar !== DEFAULT_RULES && (
            <button type="button" class="tbtn" onClick={() => setAr(DEFAULT_RULES)}>
              Restore default rules
            </button>
          )}
        </Field>
        <Field label="Same-tier traffic" tip="Whether VMs in the same tier (for example the two web servers) may talk to each other. Usually they do not need to, and blocking it limits lateral movement.">
          <Toggle on={intra} onChange={setIntra}>
            Allow within a tier
          </Toggle>
        </Field>
        <Field label="Isolation policy" tip="A hard wall between two groups: VMs in Environment: Production and VMs in Environment: Dev can never talk to each other, whatever other rules say." value={MODE_WORD[im]}>
          <Seg label="Isolation policy mode" value={im} options={MODE_OPTS} onChange={setIm} />
        </Field>
        <Field label="Quarantine" tip="One click removes a VM from the network. Strict blocks all traffic in and out. Forensic also lets a named group of tools (here SecOps-Tools) reach the VM to investigate." value={`${Object.keys(quarantine).length} VM${Object.keys(quarantine).length === 1 ? '' : 's'}`}>
          <span class="field-note">Select a VM on the canvas, then quarantine it.</span>
          {Object.keys(quarantine).length > 0 && (
            <button type="button" class="tbtn" onClick={() => setQs('')}>
              Release all
            </button>
          )}
        </Field>
      </div>

      <div class="stage">
        <div class="spread">
          <Seg
            label="Scenario"
            value={sc}
            onChange={setSc}
            options={[
              { value: 'sim', label: 'Traffic simulator' },
              { value: 'ran', label: 'Ransomware lateral movement' },
            ]}
          />
          <Illus why="A small sample app. Flow enforces policy in the AHV virtual switch at each VM's network interface; the packet animation, timings and attack pattern are simplified." />
        </div>

        <div class="diagram-scroll">
          <svg class="diagram fl-canvas" viewBox={`0 0 ${VW} ${VH}`} role="group" aria-label="VMs grouped by environment and tier, tagged with categories">
            <defs>
              <marker id="fl-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--s2)" />
              </marker>
            </defs>
            {TIERS.map((tn) => (
              <text key={tn} x={COL_X[tn] + BOX_W / 2} y={14} text-anchor="middle" class="muted" style={{ fontSize: '12px', letterSpacing: '0.06em' }}>
                AppTier: {tn}
              </text>
            ))}
            <rect class="fl-env" x={166} y={24} width={VW - 172} height={182} />
            <text x={178} y={44} class="fl-envlbl">
              Environment: Production
            </text>
            <rect class="fl-env dev" x={166} y={224} width={VW - 172} height={150} />
            <text x={178} y={244} class="fl-envlbl">
              Environment: Dev
            </text>
            {im !== 'off' && (
              <g>
                <line x1={172} x2={VW - 12} y1={215} y2={215} class={im === 'enforce' ? 'fl-wall on' : 'fl-wall'} />
                <text x={VW - 16} y={211} text-anchor="end" class="halo" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  Isolation {im === 'enforce' ? '(enforced)' : '(monitoring)'}
                </text>
              </g>
            )}
            {/* External client */}
            <g>
              <rect class="fl-ext" x={POS.external.x} y={POS.external.y} width={EXT_W} height={BOX_H} />
              <text x={POS.external.x + EXT_W / 2} y={POS.external.y + 22} text-anchor="middle" style={{ fontSize: '13px', fontWeight: 600 }}>
                External client
              </text>
              <text x={POS.external.x + EXT_W / 2} y={POS.external.y + 40} text-anchor="middle" class="muted" style={{ fontSize: '11px' }}>
                users / internet
              </text>
            </g>
            {vms.map((v) => (
              <VmNode
                key={v.id}
                vm={v}
                sel={sel === v.id}
                infected={infected.has(v.id)}
                quar={quarantine[v.id] ?? (ranQ.has(v.id) ? 'strict' : undefined)}
                hit={shots.find((s) => s.prog >= 1 && !s.v.allowed && s.v.atVm === v.id && s.age < 2.2) !== undefined}
                onSel={() => setSel(v.id)}
              />
            ))}
            {shots.map((s) => (
              <Shot key={s.key} src={s.src} dst={s.dst} prog={s.prog} v={s.v} age={s.age} />
            ))}
          </svg>
        </div>
        <div class="legend">
          <span>
            <i class="sw" style={{ background: 'var(--ok)' }} />
            Allowed
          </span>
          <span>
            <i class="sw" style={{ background: 'var(--warn)' }} />
            Allowed, logged as "would drop" (Monitoring)
          </span>
          <span>
            <i class="sw" style={{ background: 'var(--bad)' }} />
            Dropped at the VM's network interface
          </span>
          <span>
            <i class="sw" style={{ background: 'transparent', border: '1.5px dashed var(--bad)' }} />
            Quarantined
          </span>
        </div>

        {selVm && sc === 'sim' && (
          <div class="fl-sel">
            <div class="spread">
              <div>
                <b>{selVm.name}</b> <span class="muted mono small">{selVm.ip}</span>
                <div class="small muted">
                  {Object.entries(selVm.cats)
                    .map(([k, val]) => `${k}: ${val}`)
                    .join(' · ')}
                </div>
              </div>
              <span class="small">
                Running on <b>{HOST_NAME[selVm.host]}</b>
              </span>
            </div>
            <div class="fl-sel-acts">
              <Field label="Live-migrate" tip="Move the running VM to another host. Its categories go with it, so the same policy is enforced on the new host. No rule or IP list needs to change.">
                <Seg
                  label="Live-migrate to host"
                  value={selVm.host}
                  options={HOSTS.map((h) => ({ value: h, label: HOST_NAME[h] }))}
                  onChange={(h) => {
                    const m = { ...moves };
                    if (h === BASE_VMS.find((b) => b.id === selVm.id)!.host) delete m[selVm.id];
                    else m[selVm.id] = h;
                    setMvs(encodeMap(m));
                  }}
                />
              </Field>
              <Field label="Quarantine this VM">
                <Seg
                  label="Quarantine"
                  value={quarantine[selVm.id] ?? 'none'}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'strict', label: 'Strict' },
                    { value: 'forensic', label: 'Forensic', disabled: selVm.id === 'sec', title: selVm.id === 'sec' ? 'This is the forensic tools VM' : undefined },
                  ]}
                  onChange={(k) => {
                    const m: Record<string, string> = { ...quarantine };
                    if (k === 'none') delete m[selVm.id];
                    else m[selVm.id] = k;
                    setQs(encodeMap(m));
                  }}
                />
              </Field>
            </div>
          </div>
        )}

        {sc === 'sim' ? (
          <div class="fl-sim">
            <h3 class="sec-h">Fire a packet</h3>
            <div class="fl-sim-row">
              <label>
                <span class="small muted">From</span>
                <select class="input" value={ps} onChange={(e) => setPs((e.target as HTMLSelectElement).value)}>
                  <option value="external">External client</option>
                  {vms.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span class="small muted">To</span>
                <select class="input" value={pd} onChange={(e) => setPd((e.target as HTMLSelectElement).value)}>
                  {vms
                    .filter((v) => v.id !== ps)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span class="small muted">Port</span>
                <select class="input" value={pp} onChange={(e) => setPp(Number((e.target as HTMLSelectElement).value))}>
                  {PORTS.map((p) => (
                    <option key={p} value={p}>
                      {p} {PORT_NAME[p]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" class="btn primary" disabled={ps === pd} onClick={() => send({ src: ps, dst: pd, port: pp })}>
                <Icon name="play" />
                Send packet
              </button>
            </div>
            <div class="hstack fl-quick">
              <span class="small muted">Try:</span>
              {[
                { s: 'external', d: 'pweb1', p: 443, l: 'Users → Web :443' },
                { s: 'pweb1', d: 'papp', p: 8080, l: 'Web → App :8080' },
                { s: 'pweb1', d: 'pdb', p: 5432, l: 'Web → DB (skips a tier)' },
                { s: 'dweb', d: 'pdb', p: 5432, l: 'Dev → Prod DB' },
                { s: 'sec', d: 'pdb', p: 22, l: 'SecOps → DB :22' },
              ].map((q) => (
                <button
                  type="button"
                  class="btn"
                  key={q.l}
                  onClick={() => {
                    setPs(q.s);
                    setPd(q.d);
                    setPp(q.p);
                    send({ src: q.s, dst: q.d, port: q.p });
                  }}
                >
                  {q.l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div class="fl-sim">
            <PlayBar clock={clock} label="Ransomware scenario controls" fmt={(x) => `${x.toFixed(1)} s`} />
            <div class="hstack">
              <button type="button" class="btn primary" disabled={qAt !== null || t <= 0.1 || ranDone} onClick={() => setQAt(t)}>
                <Icon name="lock" />
                Quarantine infected VMs
              </button>
              <Toggle on={xp} onChange={setXp}>
                Attacker also uses allowed app ports (8080, 5432)
              </Toggle>
            </div>
            <p class="field-note">HR-Web-1 faces the internet and is compromised. It tries SMB, remote desktop and SSH against every other VM, and each VM it reaches does the same.</p>
          </div>
        )}
      </div>

      <div class="rail">
        {sc === 'sim' ? (
          <>
            <div class="side-sec">
              <div class="eyebrow">Last packet</div>
              {lastPkt ? (
                <Follow tone={verdictTone(lastPkt.v)} k={`${verdictWord(lastPkt.v)} · port ${lastPkt.pkt.port}`}>
                  <p>
                    {nameOf(vms, lastPkt.pkt.src)} → {nameOf(vms, lastPkt.pkt.dst)}
                  </p>
                  <p class="rest">{lastPkt.v.reason}</p>
                  {lastPkt.v.at && (
                    <p class="rest">
                      Decided in the virtual switch of <b>{HOST_NAME[lastPkt.v.at]}</b> at {nameOf(vms, lastPkt.v.atVm)}’s network interface.
                    </p>
                  )}
                </Follow>
              ) : (
                <p class="small muted">Send a packet to see which rule it hits.</p>
              )}
            </div>
            <div class="side-sec">
              <div class="eyebrow">
                <Tip text="Every policy evaluation is logged with the rule it matched. In Monitoring this is how you find flows a new policy would break, before you enforce it.">Rule-hit log</Tip>
              </div>
              <HitLog items={log.map((l) => ({ key: String(l.id), t: l.t, v: l.v, src: nameOf(vms, l.pkt.src), dst: nameOf(vms, l.pkt.dst), port: l.pkt.port }))} />
            </div>
          </>
        ) : (
          <>
            <div class="side-sec">
              <div class="eyebrow">Blast radius</div>
              <div class="bignum">
                {infected.size}
                <small>of {vms.length} VMs infected</small>
              </div>
              <Stat k="Attempts" v={ranStats.attempts} />
              <Stat k="Dropped" v={ranStats.blocked} tone={ranStats.blocked ? 'ok' : 'neutral'} />
              <Stat k="Would drop (Monitoring)" v={ranStats.would} tone={ranStats.would ? 'warn' : 'neutral'} />
              {ranDone && (
                <Follow tone={infected.size <= Math.max(1, ran.qIds.length) ? 'ok' : 'bad'} k={infected.size === 1 ? 'Contained' : qAt !== null ? 'Contained after quarantine' : 'Spread'}>
                  <p>
                    {infected.size === 1
                      ? 'Policy stopped every lateral move: the infection stayed on HR-Web-1.'
                      : qAt !== null
                        ? `Quarantine cut off the ${ran.qIds.length} infected VM${ran.qIds.length === 1 ? '' : 's'} at once. Nothing new was reached after that.`
                        : am === 'enforce' && xp
                          ? 'Enforced rules still allow the app’s own ports, so an attacker exploiting them follows the allowed path. Quarantine is the next step.'
                          : am !== 'enforce' || im !== 'enforce'
                            ? 'With policies saved but not applied, or in Monitoring, nothing is blocked. Monitoring logs every flow it would block, which is the safe way to start, but it does not protect.'
                            : 'The infection spread.'}
                  </p>
                </Follow>
              )}
            </div>
            <div class="side-sec">
              <div class="eyebrow">Rule-hit log</div>
              <HitLog
                items={[...ranVisible]
                  .reverse()
                  .slice(0, 40)
                  .map((e, i) => ({ key: `${i}-${e.time}`, t: e.time, v: e.verdict, src: nameOf(vms, e.src), dst: nameOf(vms, e.dst), port: e.port, extra: e.infects ? 'infected' : undefined }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HitLog({ items }: { items: { key: string; t: number; v: Verdict; src: string; dst: string; port: number; extra?: string }[] }) {
  if (!items.length) return <p class="small muted">Nothing yet.</p>;
  return (
    <ul class="events fl-log" aria-live="polite">
      {items.map((i) => {
        const tone = verdictTone(i.v);
        const hit = i.v.hits.find((h) => h.action !== 'allow') ?? i.v.hits[0];
        return (
          <li key={i.key}>
            <span class="t">{i.t.toFixed(1)} s</span>
            <span class={`${tone}-text`}>
              <Icon name={tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : 'bad'} />
            </span>
            <span>
              <b>{verdictWord(i.v)}</b> {i.src} → {i.dst} :{i.port}
              {i.extra && <span class="bad-text"> · {i.extra}</span>}
              <span class="fl-rule">
                {hit.policy !== '—' ? `${hit.policy}: ` : ''}
                {hit.rule}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function VmNode({ vm, sel, infected, quar, hit, onSel }: { vm: FlowVm; sel: boolean; infected: boolean; quar?: 'strict' | 'forensic'; hit: boolean; onSel: () => void }) {
  const p = POS[vm.id];
  const w = vm.id === 'sec' ? EXT_W : BOX_W;
  const cls = ['fl-vm', infected ? 'inf' : '', quar ? 'quar' : '', sel ? 'sel' : ''].join(' ');
  const tierLabel = vm.cats.AppTier ? `${vm.cats.AppTier} · ${vm.cats.Environment}` : 'AppType: Forensics';
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={sel}
      aria-label={`${vm.name}, ${tierLabel}, on ${HOST_NAME[vm.host]}${infected ? ', infected' : ''}${quar ? `, quarantined (${quar})` : ''}`}
      onClick={onSel}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel())}
    >
      <rect class={`hit ${cls}`} x={p.x} y={p.y} width={w} height={BOX_H} />
      <rect class={hit ? 'fl-nic hit-on' : 'fl-nic'} x={p.x - 5} y={p.y + BOX_H / 2 - 5} width={10} height={10}>
        <title>Virtual NIC: where Flow enforces policy</title>
      </rect>
      <text x={p.x + 12} y={p.y + 21} style={{ fontSize: '13.5px', fontWeight: 600 }}>
        {vm.name}
      </text>
      <text x={p.x + 12} y={p.y + 40} class="muted" style={{ fontSize: '11px' }}>
        {vm.id === 'sec' ? 'Forensics' : tierLabel}
      </text>
      <text x={p.x + w - 10} y={p.y + 21} text-anchor="end" class="mono faint" style={{ fontSize: '10.5px' }}>
        {HOST_NAME[vm.host].replace('Host ', 'H')}
      </text>
      {infected && (
        <text x={p.x + w - 10} y={p.y + 40} text-anchor="end" class="bad-fill" style={{ fontSize: '11px', fontWeight: 700 }}>
          ✕ infected
        </text>
      )}
      {quar && !infected && (
        <text x={p.x + w - 10} y={p.y + 40} text-anchor="end" class="bad-fill" style={{ fontSize: '11px', fontWeight: 600 }}>
          quarantine
        </text>
      )}
      {quar && infected && (
        <text x={p.x + w - 10} y={p.y - 4} text-anchor="end" class="bad-fill halo" style={{ fontSize: '11px', fontWeight: 600 }}>
          quarantined
        </text>
      )}
    </g>
  );
}

function Shot({ src, dst, prog, v, age }: { src: string; dst: string; prog: number; v: Verdict; age: number }) {
  const a = center(src);
  const b = center(dst);
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - 26 - Math.abs(a.x - b.x) * 0.04;
  const stopAt = v.allowed ? 1 : v.atVm === src ? 0.12 : 0.9;
  const q = Math.min(prog, stopAt) / 1;
  const pt = (s: number) => ({
    x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * mx + s * s * b.x,
    y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * my + s * s * b.y,
  });
  const dot = pt(q);
  const tone = verdictTone(v);
  const fade = age > 1.6 ? Math.max(0, 1 - (age - 1.6) / 0.6) : 1;
  const reached = prog >= stopAt;
  return (
    <g style={{ opacity: fade }} aria-hidden="true">
      <path d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} class={`fl-path ${tone}`} />
      <circle cx={dot.x} cy={dot.y} r={7} class={`${tone}-fill`} />
      {reached && !v.allowed && (
        <g>
          <circle cx={dot.x} cy={dot.y} r={12} class="fl-x" />
          <path d={`M${dot.x - 5} ${dot.y - 5} L${dot.x + 5} ${dot.y + 5} M${dot.x + 5} ${dot.y - 5} L${dot.x - 5} ${dot.y + 5}`} class="fl-xmark" />
        </g>
      )}
      {reached && v.allowed && (
        <path d={`M${b.x - 6} ${b.y - 30} l4 4 l8 -8`} class={`fl-check ${tone}`} />
      )}
    </g>
  );
}

