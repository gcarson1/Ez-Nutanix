// Disaster Recovery: RPO tiers, the sync latency gate, live data-loss exposure, recovery plans,
// and failover scenarios (planned, unplanned, test, failback, multi-site, cloud).
import './style.css';
import { useEffect, useMemo } from 'preact/hooks';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Tip, Toggle, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useClock } from '../../components/clock';
import { setParams, useBool, useEnum, useNum, useStr } from '../../../state/route';
import {
  RPO_STOPS,
  SYNC_RTT_LIMIT_MS,
  TIER_LABEL,
  buildSequence,
  effectiveTier,
  exposureAt,
  exposureSeries,
  fmtSpan,
  keepsUp,
  recoveryOptions,
  stateAt,
  syncWritePenaltyMs,
  transferTime,
  worstExposure,
  type FailoverKind,
  type Link,
  type RemoteSite,
  type SiteState,
  type StageCfg,
  type Tier,
} from '../../../engine/dr';

type Sc = 'planned' | 'unplanned' | 'test' | 'failback' | 'multi' | 'cloud';
const SC_ALL: Sc[] = ['planned', 'unplanned', 'test', 'failback', 'multi', 'cloud'];
const SC_LABEL: Record<Sc, string> = {
  planned: 'Planned failover',
  unplanned: 'Unplanned failover',
  test: 'Test failover',
  failback: 'Failback',
  multi: 'Multi-site',
  cloud: 'DR to cloud (NC2)',
};

const STAGES: StageCfg[] = [
  { name: 'database', vms: ['DB-1'] },
  { name: 'app tier', vms: ['App-1'] },
  { name: 'web tier', vms: ['Web-1', 'Web-2'] },
];
const VM_STAGE = [
  { n: 'DB-1', s: 0 },
  { n: 'App-1', s: 1 },
  { n: 'Web-1', s: 2 },
  { n: 'Web-2', s: 2 },
];

// Multi-site example policies (values chosen inside the documented ranges; latencies illustrative).
const MULTI: RemoteSite[] = [
  { id: 'B', name: 'Site B', rpoS: 0, rttMs: 2 },
  { id: 'C', name: 'Site C', rpoS: 300, rttMs: 18 },
  { id: 'D', name: 'Site D', rpoS: 3600, rttMs: 45 },
];

const TIER_TONE: Record<Tier, Tone> = { sync: 'ok', nearsync: 'flow', async: 'neutral', none: 'bad' };

function fmtMB(mb: number): string {
  if (!Number.isFinite(mb)) return 'unbounded';
  if (mb < 1) return '0 MB';
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function nearestStop(v: number): number {
  let best = 0;
  for (let i = 0; i < RPO_STOPS.length; i++) if (Math.abs(RPO_STOPS[i] - v) < Math.abs(RPO_STOPS[best] - v)) best = i;
  return best;
}

export default function Dr() {
  const [preset] = useStr('preset', '');
  const pair = preset === 'pair';
  const scOpts = pair ? SC_ALL.filter((s) => s !== 'multi' && s !== 'cloud') : SC_ALL;
  const [scRaw, setSc] = useEnum<Sc>('sc', 'unplanned', SC_ALL);
  const sc: Sc = scOpts.includes(scRaw) ? scRaw : 'unplanned';
  const [rpoRaw, setRpo] = useNum('rpo', 3600, 0, 86400);
  const rpoIdx = nearestStop(rpoRaw);
  const rpo = RPO_STOPS[rpoIdx];
  const [rtt, setRtt] = useNum('lat', 2, 0.5, 60);
  const [chg, setChg] = useNum('chg', 2, 0.5, 40);
  const [bw, setBw] = useNum('bw', 60, 1, 1000);
  const [witness, setWitness] = useBool('w', true);
  const [dly, setDly] = useNum('dly', 30, 0, 300);
  const [netMap, setNetMap] = useBool('nm', true);
  const [scripts, setScripts] = useBool('scr', true);
  const [dt, setDt] = useNum('dt', 70, 1, 100);
  const [lost, setLost] = useEnum<'A' | 'AB'>('lost', 'A', ['A', 'AB']);

  const multi = sc === 'multi';
  const eff = effectiveTier(rpo, rtt);
  const link: Link = { rpoS: eff.tier === 'sync' ? 0 : rpo, changeMBps: chg, bwMBps: bw };
  const keeps = keepsUp(link);
  const worst = worstExposure(link);

  // Chart window: three replication cycles (or one hour for sync).
  const cycle = link.rpoS > 0 ? link.rpoS + (keeps ? transferTime(link) : link.rpoS) : 1200;
  const W = Math.max(3 * cycle, link.rpoS > 0 ? 3 * link.rpoS : 3600);
  const td = (dt / 100) * W;
  const lagS = exposureAt(link, td);

  // Multi-site: recovery target and its lag at the disaster instant.
  const lostIds = lost === 'AB' ? ['B'] : [];
  const multiOpts = recoveryOptions(MULTI, lostIds, (s) => exposureAt({ rpoS: s.rpoS, changeMBps: chg, bwMBps: bw }, td));
  const multiTarget = multiOpts[0];

  const kind: FailoverKind = sc === 'multi' || sc === 'cloud' ? 'unplanned' : sc;
  const seqTier: Tier = multi ? multiTarget?.tier ?? 'none' : eff.tier;
  const seqLag = multi ? multiTarget?.lossS ?? 0 : lagS;
  const seq = useMemo(
    () => buildSequence({ kind, tier: seqTier, lagS: seqLag, witness, stageDelayS: dly, stages: STAGES, netMap, scripts }),
    [kind, seqTier, seqLag, witness, dly, netMap, scripts],
  );
  const invalid = !multi && eff.tier === 'none';

  const clock = useClock({ rate: seq.duration / 24, duration: seq.duration, stepSize: seq.duration / 48, keys: true });
  useEffect(() => clock.reset(), [sc, kind, seqTier, witness, dly, netMap, scripts, lost, preset]);
  const st = stateAt(seq, clock.t);
  const started = clock.t > 0;

  const targetName = sc === 'cloud' ? 'Cloud (NC2)' : sc === 'failback' ? 'Site A' : multi ? multiTarget?.site.name ?? '—' : 'Site B';

  return (
    <>
      {pair && (
        <div class="dr-preset spread">
          <span>
            <Chip tone="flow" icon="globe">
              Two-site DR pair
            </Chip>{' '}
            <span class="small muted">Site A protects its applications to Site B.</span>
          </span>
          <button type="button" class="tbtn" onClick={() => setParams({ preset: null })}>
            Show multi-site and cloud scenarios <Icon name="arrow" />
          </button>
        </div>
      )}
      <div class="tabs" role="tablist" aria-label="Scenario">
        {scOpts.map((s) => (
          <button type="button" role="tab" key={s} aria-selected={sc === s} onClick={() => setSc(s)}>
            {SC_LABEL[s]}
          </button>
        ))}
      </div>

      <div class="lab">
        <div class="ctl">
          <Field
            label="RPO (recovery point objective)"
            tip="How much recent data you can afford to lose, expressed as time. The protection policy picks the replication tier from it."
            detail="RPO 0 is synchronous. 1 to 15 minutes is NearSync. 1 hour or more (up to 24 hours) is asynchronous."
            value={fmtSpan(rpo)}
            why={multi ? 'Multi-site uses its own example policies, shown on the map.' : eff.blocked ? 'Sync is selected but blocked by latency (see below).' : null}
          >
            <Slider value={rpoIdx} min={0} max={RPO_STOPS.length - 1} onChange={(i) => setRpo(RPO_STOPS[i])} label="RPO" />
            <div class="dr-tierbar" aria-hidden="true">
              <span class={eff.tier === 'sync' || (eff.blocked && rpo === 0) ? 'on' : ''}>Sync</span>
              <span class={eff.tier === 'nearsync' ? 'on' : ''}>NearSync</span>
              <span class={eff.tier === 'async' ? 'on' : ''}>Async</span>
            </div>
          </Field>
          <Field
            label="Round-trip latency"
            tip={`Time for a packet to reach the recovery site and come back. Synchronous replication needs less than ${SYNC_RTT_LIMIT_MS} ms, because every write waits for the remote copy.`}
            value={`${rtt} ms`}
            why={!multi && rtt >= SYNC_RTT_LIMIT_MS ? `Sync is unavailable at ${rtt} ms: it needs under ${SYNC_RTT_LIMIT_MS} ms round trip.` : null}
          >
            <Slider value={rtt} min={0.5} max={60} step={0.5} onChange={setRtt} label="Round-trip latency in milliseconds" />
          </Field>
          <Field label="Change rate" tip="How fast the protected VMs write new data. Higher change rate means more to ship each cycle." value={`${chg} MB/s`}>
            <Slider value={chg} min={0.5} max={40} step={0.5} onChange={setChg} label="Change rate in megabytes per second" />
          </Field>
          <Field
            label="Replication bandwidth"
            tip="Network throughput available for replication between the sites."
            value={`${bw} MB/s`}
            why={!keeps && link.rpoS > 0 ? 'Bandwidth is too low for this change rate: each recovery point takes longer to ship than the RPO, so the policy falls behind.' : null}
          >
            <Slider value={bw} min={1} max={1000} step={1} onChange={setBw} label="Replication bandwidth in megabytes per second" />
          </Field>
          <Field
            label="Witness"
            tip="A third party in a separate fault domain that both sites can reach. With synchronous replication it lets the surviving site fail over automatically, because it can tell a site failure from a broken link."
            why={seqTier !== 'sync' ? 'Applies to synchronous replication only.' : null}
          >
            <Toggle on={witness} onChange={setWitness} disabled={seqTier !== 'sync'}>
              Witness configured
            </Toggle>
          </Field>
          <Field label="Recovery plan" tip="The runbook for failover: boot order in stages, delays between stages, network mapping and optional in-guest scripts." value={`${STAGES.length} stages`}>
            <span class="small muted">Delay between stages: {dly} s</span>
            <Slider value={dly} min={0} max={300} step={10} onChange={setDly} label="Delay between stages in seconds" />
            <div class="toggles">
              <Toggle on={netMap} onChange={setNetMap}>
                Network mapping
              </Toggle>
              <Toggle on={scripts} onChange={setScripts}>
                In-guest scripts
              </Toggle>
            </div>
          </Field>
        </div>

        <div class="stage">
          <div class="spread">
            <span class="hstack">
              {!multi && (
                <Chip tone={TIER_TONE[eff.tier]} lg icon={eff.tier === 'none' ? 'bad' : eff.tier === 'sync' ? 'ok' : 'flow'}>
                  {eff.blocked ? 'Sync blocked by latency' : TIER_LABEL[eff.tier]}
                </Chip>
              )}
              <span class="small muted">{multi ? 'Site A replicates to three sites with different policies.' : eff.reason}</span>
            </span>
            <Illus why="Sites, VM counts, boot and transfer times are simplified. The RPO tiers and the 5 ms synchronous limit follow Nutanix documentation; the exposure model assumes recovery points every RPO interval, each shipped after it is taken." />
          </div>

          <div class="diagram-scroll">
            <SiteMap sc={sc} tier={eff.tier} blocked={eff.blocked} rpo={rpo} rtt={rtt} witness={witness && seqTier === 'sync'} lost={lost} st={st} started={started} multiTarget={multiTarget?.site.id} />
          </div>

          {multi && (
            <div class="dr-multi">
              <Seg
                label="What is lost"
                value={lost}
                onChange={setLost}
                options={[
                  { value: 'A', label: 'Lose Site A' },
                  { value: 'AB', label: 'Lose Sites A and B together' },
                ]}
              />
              <table class="tbl" style={{ marginTop: 'var(--sp-3)' }}>
                <thead>
                  <tr>
                    <th>Surviving target</th>
                    <th>Policy</th>
                    <th class="num">Data lost</th>
                  </tr>
                </thead>
                <tbody>
                  {MULTI.map((s) => {
                    const o = multiOpts.find((x) => x.site.id === s.id);
                    return (
                      <tr key={s.id} class={o && o === multiTarget ? 'sel' : ''}>
                        <td>
                          {s.name} {!o && <span class="bad-text">· lost</span>}
                          {o && o === multiTarget && <span class="ok-text"> · recover here</span>}
                        </td>
                        <td>
                          {TIER_LABEL[effectiveTier(s.rpoS, s.rttMs).tier]} · RPO {fmtSpan(s.rpoS)}
                        </td>
                        <td class="num">{o ? `${fmtSpan(o.lossS)} · ${fmtMB(o.lossS * chg)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
                Synchronous partners are close together, so one regional event can take out both. A farther NearSync or async copy is what survives it.
              </p>
            </div>
          )}

          {!multi && (
            <>
              <h3 class="dr-h3">
                <Tip text="How many seconds of recent writes exist only at Site A at each moment. It climbs until the next recovery point lands at the recovery site, then drops: a sawtooth.">Data-loss exposure over time</Tip>
              </h3>
              <ExposureChart link={link} W={W} td={td} rtt={rtt} sync={eff.tier === 'sync'} invalid={invalid} showMarker={kind === 'unplanned'} />
              {kind === 'unplanned' && !invalid && eff.tier !== 'sync' && (
                <Field label="When disaster strikes" value={`t = ${fmtSpan(td)}`} tip="Drag to choose the moment Site A is lost. Data loss is the exposure at that instant.">
                  <Slider value={dt} min={1} max={100} onChange={setDt} label="Time of disaster" />
                </Field>
              )}
            </>
          )}

          <h3 class="dr-h3">{SC_LABEL[sc]}: recovery plan run</h3>
          {invalid ? (
            <Follow tone="bad" k="No valid protection policy">
              <p>{eff.reason}</p>
              <p class="rest">Raise the RPO to 1 minute or more (NearSync or async), or bring the round trip under {SYNC_RTT_LIMIT_MS} ms.</p>
            </Follow>
          ) : multi && !multiTarget ? (
            <Follow tone="bad" k="Nothing to recover to">
              <p>Every recovery target is lost.</p>
            </Follow>
          ) : (
            <>
              <PlayBar clock={clock} label="Failover sequence controls" />
              <Timeline seq={seq} t={clock.t} />
              <Follow tone={!started || st.step.tone === 'neutral' ? 'ink' : st.step.tone} k={started ? st.step.label : 'Ready'}>
                <p>{started ? st.step.detail : `Press Play to run the ${SC_LABEL[sc].toLowerCase()}${sc === 'test' ? '' : ` to ${targetName}`}.`}</p>
              </Follow>
            </>
          )}
        </div>

        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">Protection policy</div>
            {multi ? (
              <>
                <Stat k="A → B" v="Sync · RPO 0" />
                <Stat k="A → C" v="NearSync · 5 min" />
                <Stat k="A → D" v="Async · 1 h" />
              </>
            ) : (
              <>
                <Stat k="Tier" v={eff.blocked ? 'blocked' : TIER_LABEL[eff.tier]} tone={eff.blocked ? 'bad' : undefined} />
                <Stat k="RPO target" v={fmtSpan(rpo)} />
                <Stat
                  k="Worst-case exposure"
                  v={invalid ? '—' : fmtSpan(worst)}
                  tone={!keeps ? 'bad' : undefined}
                  tip="RPO plus the time to ship one recovery point. If the link cannot keep up, exposure keeps growing."
                />
                {eff.tier === 'sync' && <Stat k="Added write latency" v={`≈ ${syncWritePenaltyMs(rtt)} ms`} tip="Each write waits for the remote acknowledgment, so it pays about one round trip. Illustrative." />}
                <Stat k="Recovery location" v={sc === 'cloud' ? 'NC2 (cloud)' : sc === 'failback' ? 'Site A (returning)' : 'Site B'} />
              </>
            )}
          </div>
          {!invalid && !(multi && !multiTarget) && (
            <div class="side-sec">
              <div class="eyebrow">Outcome</div>
              <div class={`bignum ${seq.dataLossS > 0 ? 'warn-text' : 'ok-text'}`}>
                {fmtSpan(seq.dataLossS)}
                <small class="dr-small">data lost</small>
              </div>
              <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
                {seq.dataLossS > 0
                  ? `≈ ${fmtMB(seq.dataLossS * chg)} of writes since the last recovery point that reached ${targetName}.`
                  : kind === 'planned' || kind === 'failback'
                    ? 'Planned: VMs shut down first and the last changes are replicated, so nothing is lost.'
                    : kind === 'test'
                      ? 'Test failover runs on clones in an isolated network. Production is untouched.'
                      : 'Synchronous: every acknowledged write already exists at the recovery site.'}
              </p>
              <Stat k="Decision" v={kind === 'unplanned' ? (seq.manualDecision ? 'manual' : 'automatic (Witness)') : 'scheduled'} />
              <Stat k="Plan duration" v={fmtSpan(seq.duration)} tip="Illustrative: boot times and delays are example values." />
              <Stat k="Apps reachable after" v={seq.reachable ? 'yes' : 'no'} tone={seq.reachable ? 'ok' : 'bad'} />
              {!seq.reachable && <p class="small bad-text">Without network mapping the VMs boot but are not connected to the right networks at {targetName}.</p>}
            </div>
          )}
          <div class="side-sec">
            <div class="eyebrow">Events</div>
            <ul class="events">
              {seq.steps
                .filter((s) => clock.t >= s.start && started)
                .reverse()
                .map((s) => (
                  <li key={s.id}>
                    <span class="t">{fmtClockShort(s.start)}</span>
                    <span class={s.tone === 'neutral' ? 'muted' : `${s.tone}-text`}>
                      <Icon name={s.tone === 'bad' ? 'bad' : s.tone === 'warn' ? 'warn' : s.tone === 'ok' ? 'ok' : 'flow'} />
                    </span>
                    <span>{s.label}</span>
                  </li>
                ))}
            </ul>
            {!started && <p class="small muted">Nothing yet.</p>}
          </div>
        </div>
      </div>

      {sc === 'cloud' && (
        <Follow tone="ink" k="Nutanix Cloud Clusters (NC2)">
          <p>NC2 runs the same AOS and AHV stack on bare-metal instances in AWS, Microsoft Azure, Google Cloud or OVHcloud, so the cloud site uses the same protection policies, recovery plans and console as an on-premises site.</p>
          <p class="rest">Which replication tiers and regions are available depends on the cloud and the release. Cloud round-trip times are often too high for synchronous replication; check the latency to your chosen region.</p>
        </Follow>
      )}
    </>
  );
}

function fmtClockShort(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── map ──

interface SiteBox {
  id: string;
  x: number;
  y: number;
  title: string;
  sub: string;
  state: SiteState | 'lost' | 'idle' | 'replica';
  /** This site is where VMs are being recovered (stages power on here). */
  rec: boolean;
}

function SiteMap({
  sc,
  tier,
  blocked,
  rpo,
  rtt,
  witness,
  lost,
  st,
  started,
  multiTarget,
}: {
  sc: Sc;
  tier: Tier;
  blocked: boolean;
  rpo: number;
  rtt: number;
  witness: boolean;
  lost: 'A' | 'AB';
  st: ReturnType<typeof stateAt>;
  started: boolean;
  multiTarget?: string;
}) {
  const VW = 900;
  const VH = sc === 'multi' ? 380 : witness ? 270 : 180;
  const SY = witness ? 120 : 34;
  const BW = 230;
  const BH = 112;
  const sites: SiteBox[] = [];
  const links: { from: string; to: string; label: string; sub: string; tone: string; rev?: boolean }[] = [];
  const tierText = blocked ? 'Sync blocked' : TIER_LABEL[tier];

  if (sc === 'multi') {
    const aDown = started;
    sites.push({ id: 'A', x: 20, y: 134, title: 'Site A', sub: 'primary', state: aDown ? 'lost' : 'running', rec: false });
    const pos: Record<string, { x: number; y: number }> = { B: { x: 420, y: 14 }, C: { x: 420, y: 254 }, D: { x: 650, y: 134 } };
    for (const s of MULTI) {
      const isLost = started && lost === 'AB' && s.id === 'B';
      const isTarget = s.id === multiTarget;
      sites.push({
        id: s.id,
        x: pos[s.id].x,
        y: pos[s.id].y,
        title: s.name,
        sub: `${TIER_LABEL[effectiveTier(s.rpoS, s.rttMs).tier]} · RPO ${fmtSpan(s.rpoS)}`,
        state: isLost ? 'lost' : isTarget && started ? st.recovery : 'replica',
        rec: isTarget,
      });
      links.push({ from: 'A', to: s.id, label: TIER_LABEL[effectiveTier(s.rpoS, s.rttMs).tier], sub: `${s.rttMs} ms RTT`, tone: s.rpoS === 0 ? 'ok' : 'flow' });
    }
  } else {
    const failback = sc === 'failback';
    const tgtId = sc === 'cloud' ? 'CL' : 'B';
    const aState: SiteBox['state'] = failback ? (started ? st.recovery : 'off') : sc === 'unplanned' || sc === 'cloud' ? (started ? 'lost' : 'running') : st.primary;
    const bState: SiteBox['state'] = tier === 'none' ? 'idle' : failback ? st.primary : started ? st.recovery : 'replica';
    sites.push({ id: 'A', x: 40, y: SY, title: 'Site A', sub: failback ? 'original primary, now repaired' : 'primary', state: aState, rec: failback });
    sites.push({
      id: tgtId,
      x: VW - 40 - BW,
      y: SY,
      title: sc === 'cloud' ? 'Cloud · NC2' : 'Site B',
      sub: failback ? 'running the apps since failover' : sc === 'cloud' ? 'recovery cluster in a public cloud' : 'recovery site',
      state: bState,
      rec: !failback,
    });
    links.push({ from: 'A', to: tgtId, rev: failback, label: failback ? `${tierText} (reversed)` : tierText, sub: `RPO ${fmtSpan(rpo)} · ${rtt} ms RTT`, tone: blocked || tier === 'none' ? 'bad' : tier === 'sync' ? 'ok' : 'flow' });
  }
  const byId = Object.fromEntries(sites.map((s) => [s.id, s]));

  return (
    <svg class="diagram dr-map" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Sites: ${sites.map((s) => `${s.title} ${s.state}`).join(', ')}`}>
      <defs>
        <marker id="dr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--s2)" />
        </marker>
      </defs>
      {links.map((l) => {
        const a = byId[l.from];
        const b = byId[l.to];
        const ax = a.x + BW;
        const ay = a.y + BH / 2;
        const bx = b.x;
        const by = b.y + BH / 2;
        const broken = a.state === 'lost' || b.state === 'lost';
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        return (
          <g key={`${l.from}-${l.to}`}>
            <path
              d={l.rev ? `M${ax + 4} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}` : `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx - 4} ${by}`}
              class={`dr-link ${l.tone}${broken ? ' broken' : ''}`}
              marker-end={l.rev ? undefined : 'url(#dr-arr)'}
              marker-start={l.rev ? 'url(#dr-arr)' : undefined}
            />
            <text x={mx} y={my - 8} text-anchor="middle" class="halo" style={{ fontSize: '13px', fontWeight: 600 }}>
              {l.label}
            </text>
            <text x={mx} y={my + 10} text-anchor="middle" class="halo muted mono" style={{ fontSize: '11px' }}>
              {l.sub}
            </text>
          </g>
        );
      })}
      {witness && byId.B && (
        <g>
          {(() => {
            const wx = sc === 'multi' ? 150 : VW / 2;
            const wy = sc === 'multi' ? 30 : 30;
            const b = byId.B;
            const a = byId.A;
            return (
              <>
                <path d={`M${wx} ${wy + 36} L${a.x + BW / 2} ${a.y}`} class="dr-wline" />
                <path d={`M${wx + 70} ${wy + 18} L${b.x + (sc === 'multi' ? 0 : BW / 2)} ${sc === 'multi' ? b.y + BH / 2 : b.y}`} class="dr-wline" />
                <rect x={wx - 70} y={wy} width={140} height={36} class="bg3" stroke="var(--line-2)" />
                <text x={wx} y={wy + 15} text-anchor="middle" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  Witness
                </text>
                <text x={wx} y={wy + 29} text-anchor="middle" class="muted" style={{ fontSize: '10.5px' }}>
                  separate fault domain
                </text>
              </>
            );
          })()}
        </g>
      )}
      {sites.map((s) => (
        <SiteNode key={s.id} s={s} w={BW} h={BH} stagesUp={st.stagesUp} test={sc === 'test'} />
      ))}
    </svg>
  );
}

const STATE_WORD: Record<SiteBox['state'], { w: string; tone: string }> = {
  running: { w: 'apps running', tone: 'ok' },
  stopping: { w: 'shutting down', tone: 'warn' },
  off: { w: 'apps off', tone: 'muted' },
  down: { w: 'site down', tone: 'bad' },
  lost: { w: '✕ site lost', tone: 'bad' },
  test: { w: 'test clones on isolated network', tone: 'flow' },
  idle: { w: 'not protected', tone: 'bad' },
  replica: { w: 'receiving replicas', tone: 'flow' },
};

function SiteNode({ s, w, h, stagesUp, test }: { s: SiteBox; w: number; h: number; stagesUp: number; test: boolean }) {
  const word = STATE_WORD[s.state];
  const lost = s.state === 'lost' || s.state === 'down';
  return (
    <g>
      <rect x={s.x} y={s.y} width={w} height={h} class={`node-box${lost ? ' down' : ''}`} />
      {s.id === 'CL' && <path d={`M${s.x + w - 44} ${s.y + 22} a10 10 0 0 1 18 -6 a8 8 0 0 1 14 6 a6 6 0 0 1 0 12 h-30 a6 6 0 0 1 -2 -12z`} class="ink-stroke" stroke-width={1.5} />}
      <text x={s.x + 14} y={s.y + 24} style={{ fontSize: '15px', fontWeight: 600 }}>
        {s.title}
      </text>
      <text x={s.x + 14} y={s.y + 42} class="muted" style={{ fontSize: '11.5px' }}>
        {s.sub}
      </text>
      {test && s.state === 'test' && <rect x={s.x + 8} y={s.y + 52} width={w - 16} height={36} class="dr-testnet" />}
      {VM_STAGE.map((v, i) => {
        const x = s.x + 14 + i * 52;
        const y = s.y + 58;
        let mod = 'rep';
        if (lost) mod = 'lost';
        else if (!s.rec) mod = s.state === 'running' ? 'on' : s.state === 'stopping' ? 'stopping' : 'rep';
        else if (s.state === 'running') mod = stagesUp > v.s ? 'on' : 'rep';
        else if (s.state === 'test') mod = stagesUp > v.s ? 'test' : 'rep';
        const cls = `dr-vm ${mod}`;
        return (
          <g key={v.n}>
            <rect x={x} y={y} width={46} height={24} class={cls} />
            <text x={x + 23} y={y + 16} text-anchor="middle" class="mono" style={{ fontSize: '9.5px' }}>
              {v.n}
            </text>
          </g>
        );
      })}
      <text x={s.x + 14} y={s.y + h - 10} class={`dr-state ${word.tone}`} style={{ fontSize: '12px', fontWeight: 600 }}>
        {word.w}
      </text>
    </g>
  );
}

// ── exposure chart ──

function ExposureChart({ link, W, td, rtt, sync, invalid, showMarker }: { link: Link; W: number; td: number; rtt: number; sync: boolean; invalid: boolean; showMarker: boolean }) {
  const CW = 860;
  const CH = 200;
  const L = 84;
  const R = 16;
  const T = 14;
  const B = 34;
  const pts = invalid ? [] : exposureSeries(link, W, 300);
  const maxS = Math.max(link.rpoS * 1.6, ...pts.map((p) => p.s), 60);
  const x = (t: number) => L + (t / W) * (CW - L - R);
  const y = (s: number) => T + (1 - Math.min(1, s / maxS)) * (CH - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * W);
  const yt = [0, maxS / 2, maxS];
  const markS = exposureAt(link, td);
  return (
    <div class="diagram-scroll">
      <svg class="diagram dr-chart" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={sync ? 'Exposure is zero at all times with synchronous replication' : `Exposure sawtooth: up to ${fmtSpan(worstExposure(link))}`}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={CW - R} y1={y(v)} y2={y(v)} class="dr-grid" />
            <text x={L - 8} y={y(v) + 4} text-anchor="end" class="mono muted" style={{ fontSize: '10.5px' }}>
              {fmtSpan(v)}
            </text>
          </g>
        ))}
        {ticks.map((t, i) => (
          <text key={t} x={x(t)} y={CH - 12} text-anchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} class="mono muted" style={{ fontSize: '10.5px' }}>
            {fmtSpan(t)}
          </text>
        ))}
        {link.rpoS > 0 && !invalid && (
          <g>
            <line x1={L} x2={CW - R} y1={y(link.rpoS)} y2={y(link.rpoS)} class="dr-rpo" />
            <text x={CW - R - 4} y={y(link.rpoS) - 6} text-anchor="end" class="muted halo" style={{ fontSize: '11px' }}>
              RPO {fmtSpan(link.rpoS)}
            </text>
          </g>
        )}
        {!invalid && <polyline points={pts.map((p) => `${x(p.t).toFixed(1)},${y(p.s).toFixed(1)}`).join(' ')} class={`dr-saw${keepsUp(link) ? '' : ' bad'}`} />}
        {!invalid && pts.length > 0 && (
          <polygon points={`${x(0)},${y(0)} ${pts.map((p) => `${x(p.t).toFixed(1)},${y(p.s).toFixed(1)}`).join(' ')} ${x(W)},${y(0)}`} class={`dr-saw-fill${keepsUp(link) ? '' : ' bad'}`} />
        )}
        {sync && !invalid && (
          <text x={(L + CW) / 2} y={y(0) - 14} text-anchor="middle" class="ok-fill halo" style={{ fontSize: '13px', fontWeight: 600 }}>
            Zero exposure: every write is at both sites before it is acknowledged (+≈{rtt} ms per write)
          </text>
        )}
        {!keepsUp(link) && !invalid && (
          <text x={(L + CW) / 2} y={T + 14} text-anchor="middle" class="bad-fill halo" style={{ fontSize: '13px', fontWeight: 600 }}>
            Link cannot keep up: exposure keeps growing past the RPO
          </text>
        )}
        {invalid && (
          <text x={(L + CW) / 2} y={CH / 2} text-anchor="middle" class="bad-fill" style={{ fontSize: '13px', fontWeight: 600 }}>
            No valid policy
          </text>
        )}
        {showMarker && !invalid && !sync && (
          <g>
            <line x1={x(td)} x2={x(td)} y1={T} y2={CH - B} class="dr-mark" />
            <circle cx={x(td)} cy={y(markS)} r={5} class="bad-fill" />
            <text x={x(td) + (x(td) > CW - 200 ? -8 : 8)} y={T + 30} text-anchor={x(td) > CW - 200 ? 'end' : 'start'} class="bad-fill halo" style={{ fontSize: '12px', fontWeight: 600 }}>
              Disaster: {fmtSpan(markS)} lost
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── timeline ──

function Timeline({ seq, t }: { seq: ReturnType<typeof buildSequence>; t: number }) {
  return (
    <ol class="dr-steps">
      {seq.steps.map((s) => {
        const done = t >= s.end;
        const cur = t >= s.start && t < s.end;
        return (
          <li key={s.id} class={done ? 'done' : cur ? 'cur' : ''}>
            <span class="dr-mk" aria-hidden="true">
              {done ? '✓' : cur ? '✱' : '○'}
            </span>
            <span class="dr-lbl">{s.label}</span>
            <span class="mono faint small">{fmtClockShort(s.start)}</span>
          </li>
        );
      })}
    </ol>
  );
}
