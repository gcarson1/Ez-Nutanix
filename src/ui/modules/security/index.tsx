// Data Security: encryption at rest and key management against concrete threats, the hardening
// baseline (security profiles with drift remediation), and where Flow and the other layers fit.
import './style.css';
import { Field, Follow, Illus, PlayBar, Seg, Stat, Tip, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useClock } from '../../components/clock';
import { useEnum } from '../../../state/route';
import { go } from '../../shell/nav';

type Enc = 'none' | 'sw' | 'sed' | 'dual';
type Km = 'native' | 'ext';
type Threat = 'drive' | 'node' | 'vm' | 'ransom';
type Prof = 'standard' | 'elevated' | 'strict';

const ENC_LABEL: Record<Enc, string> = { none: 'None', sw: 'Software', sed: 'Self-encrypting drives', dual: 'Dual (both)' };
const THREAT_LABEL: Record<Threat, string> = {
  drive: 'A drive is pulled and taken',
  node: 'A whole node is stolen',
  vm: 'An attacker logs into a running VM',
  ransom: 'Ransomware inside a VM',
};

interface Verdict {
  tone: Tone;
  k: string;
  text: string;
  rest: string;
}

function verdict(enc: Enc, km: Km, th: Threat): Verdict {
  if (th === 'vm' || th === 'ransom') {
    return {
      tone: 'bad',
      k: 'Encryption at rest does not help here',
      text:
        th === 'vm'
          ? 'A logged-in attacker reads data through the normal I/O path, which decrypts it for any authorized reader. Encryption at rest protects media, not running systems.'
          : 'Ransomware writes through the VM like any application, so its encrypted output is stored (and encrypted at rest) as normal data.',
      rest: 'Layers that help: Flow microsegmentation to stop lateral movement, snapshots and DR to recover, Data Lens to detect ransomware patterns on file shares.',
    };
  }
  if (enc === 'none') {
    return {
      tone: 'bad',
      k: 'Data is readable',
      text: th === 'drive' ? 'The drive holds data in the clear. Anyone with the drive can read the pieces of data stored on it.' : 'Every drive in the node holds data in the clear.',
      rest: 'Turn on software encryption or self-encrypting drives.',
    };
  }
  const where = enc === 'sw' ? 'The CVM encrypts data before it reaches the drive' : enc === 'sed' ? 'The drive encrypts data in hardware and stays locked without its key' : 'Data is encrypted in software and again by the drive';
  if (th === 'drive') {
    return {
      tone: 'ok',
      k: 'Protected',
      text: `${where}. The keys are not on the drive, so a removed drive is unreadable.`,
      rest: km === 'ext' ? 'Keys live on your external key management server.' : 'Keys are managed by the cluster itself.',
    };
  }
  // whole node
  if (km === 'ext') {
    return {
      tone: 'ok',
      k: 'Protected',
      text: `${where}. Keys come from an external key management server, which a stolen node cannot reach from somewhere else.`,
      rest: 'This is the main reason to choose an external key manager: keys and data are never in the same place.',
    };
  }
  return {
    tone: 'warn',
    k: 'Depends on configuration',
    text: `${where}. With the native key manager, keys are held by the cluster itself, so how well a whole stolen node is protected depends on the configuration and release.`,
    rest: 'If whole-node or whole-cluster theft is in your threat model, use an external key manager so keys are stored apart from the data.',
  };
}

export default function Security() {
  const [enc, setEnc] = useEnum<Enc>('enc', 'sw', ['none', 'sw', 'sed', 'dual']);
  const [kmRaw, setKm] = useEnum<Km>('km', 'native', ['native', 'ext']);
  const [th, setTh] = useEnum<Threat>('th', 'drive', ['drive', 'node', 'vm', 'ransom']);
  const [prof, setProf] = useEnum<Prof>('prof', 'elevated', ['standard', 'elevated', 'strict']);
  const km: Km = enc === 'dual' ? 'ext' : kmRaw;
  const v = verdict(enc, km, th);

  return (
    <>
      <h2 class="sec-h">Data-at-rest encryption</h2>
      <p class="lede">Encryption at rest protects data on drives that leave your control. Pick a method, a key manager and a threat, and see what it does and does not cover.</p>
      <div class="lab" style={{ marginTop: 'var(--sp-5)' }}>
        <div class="ctl">
          <Field
            label="Encryption method"
            tip="Software encryption is done by AOS in the CVM on any supported drives. Self-encrypting drives (SEDs) encrypt in the drive hardware. Dual layers software over SEDs."
            detail="Nutanix positions software encryption for most use cases, and SEDs for cases where policy or regulation requires hardware encryption. AOS software encryption uses a FIPS 140-2 Level 1 validated module (per Nutanix)."
            value={ENC_LABEL[enc]}
          >
            <div class="sc-vseg">
              <Seg label="Encryption method" value={enc} onChange={setEnc} options={(['none', 'sw', 'sed', 'dual'] as Enc[]).map((e) => ({ value: e, label: ENC_LABEL[e] }))} />
            </div>
          </Field>
          <Field
            label="Key manager"
            tip="Where the encryption keys are kept. Native: managed by the cluster, no extra server. External: your existing enterprise key management server."
            value={km === 'native' ? 'native' : 'external'}
            why={enc === 'dual' ? 'Dual encryption requires an external key manager (documented behavior; check your release).' : enc === 'none' ? 'No keys to manage without encryption.' : null}
          >
            <Seg
              label="Key manager"
              value={km}
              onChange={setKm}
              options={[
                { value: 'native', label: 'Native', disabled: enc === 'dual' || enc === 'none' },
                { value: 'ext', label: 'External KMS', disabled: enc === 'none' },
              ]}
            />
          </Field>
          <Field label="Threat" tip="What are you protecting against? Encryption at rest is aimed at the first two.">
            <div class="sc-vseg">
              <Seg label="Threat" value={th} onChange={setTh} options={(['drive', 'node', 'vm', 'ransom'] as Threat[]).map((t) => ({ value: t, label: THREAT_LABEL[t] }))} />
            </div>
          </Field>
        </div>
        <div class="stage">
          <div class="spread">
            <span class="small muted">{THREAT_LABEL[th]}</span>
            <Illus why="One node shown. Real clusters spread data across all nodes, and key handling details (key types, rotation, caching) are simplified." />
          </div>
          <div class="diagram-scroll">
            <EncDiagram enc={enc} km={km} th={th} />
          </div>
          <Follow tone={v.tone} k={v.k}>
            <p>{v.text}</p>
            <p class="rest">{v.rest}</p>
          </Follow>
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">This configuration</div>
            <Stat k="Encrypted where" v={enc === 'none' ? '—' : enc === 'sw' ? 'CVM (software)' : enc === 'sed' ? 'Drive (hardware)' : 'CVM + drive'} />
            <Stat k="Keys kept" v={enc === 'none' ? '—' : km === 'ext' ? 'External KMS' : 'On the cluster'} />
            <Stat k="Special drives needed" v={enc === 'sed' || enc === 'dual' ? 'yes (SEDs)' : 'no'} />
            <Stat k="Drive theft" v={verdict(enc, km, 'drive').tone === 'ok' ? 'protected' : 'exposed'} tone={verdict(enc, km, 'drive').tone} />
            <Stat k="Node theft" v={verdict(enc, km, 'node').tone === 'ok' ? 'protected' : verdict(enc, km, 'node').tone === 'warn' ? 'depends' : 'exposed'} tone={verdict(enc, km, 'node').tone} />
          </div>
          <div class="side-sec">
            <div class="eyebrow">Good to know</div>
            <ul class="small sc-ul">
              <li>Encryption is transparent to VMs and applications.</li>
              <li>You can start with native key management and move to an external key manager later.</li>
              <li>Which levels (cluster or container) and features are available depends on hypervisor, version and license.</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 class="sec-h">Hardening and compliance baseline</h2>
      <Hardening prof={prof} setProf={setProf} />

      <h2 class="sec-h">Where Flow fits: layers, not a single lock</h2>
      <Layers />
    </>
  );
}

// ── encryption diagram ──

function EncDiagram({ enc, km, th }: { enc: Enc; km: Km; th: Threat }) {
  const sw = enc === 'sw' || enc === 'dual';
  const sed = enc === 'sed' || enc === 'dual';
  const driveOut = th === 'drive';
  const nodeOut = th === 'node';
  const vmHit = th === 'vm' || th === 'ransom';
  const enc0 = enc !== 'none';
  const nx = nodeOut ? 90 : 40;
  return (
    <svg class="diagram" viewBox="0 0 860 330" role="img" aria-label={`Encryption: ${ENC_LABEL[enc]}, keys ${km === 'ext' ? 'external' : 'native'}, threat: ${THREAT_LABEL[th]}`}>
      {nodeOut && (
        <g>
          <rect x={nx - 20} y={8} width={540} height={314} class="sc-stolen" />
          <text x={nx - 8} y={26} class="bad-fill" style={{ fontSize: '12px', fontWeight: 700 }}>
            ✕ node taken off-site
          </text>
        </g>
      )}
      <rect x={nx} y={36} width={500} height={270} class="node-box" />
      <text x={nx + 14} y={58} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
        ONE NODE
      </text>
      {/* VMs */}
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={nx + 20 + i * 104} y={72} width={92} height={48} class={`vm${vmHit && i === 0 ? ' failed' : ''}`} />
          <text x={nx + 66 + i * 104} y={101} text-anchor="middle" style={{ fontSize: '13px' }}>
            {vmHit && i === 0 ? (th === 'ransom' ? 'ransomware' : 'attacker') : `VM ${i + 1}`}
          </text>
        </g>
      ))}
      <text x={nx + 20} y={138} class="muted" style={{ fontSize: '11px' }}>
        apps see plain data
      </text>
      {/* CVM */}
      <rect x={nx + 250} y={72} width={230} height={70} class="cvm" />
      <text x={nx + 365} y={96} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '14px' }}>
        Controller VM (AOS)
      </text>
      <text x={nx + 365} y={118} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.85)', fontSize: '12px' }}>
        {sw ? 'software encryption: on' : 'no software encryption'}
      </text>
      <path d={`M${nx + 204} 96 H${nx + 250}`} class="flow-stroke" stroke-width={2} />
      {/* drives */}
      {[0, 1, 2, 3, 4].map((i) => {
        const pulled = driveOut && i === 4;
        const x = nx + 30 + i * 92 + (pulled ? 560 - i * 92 + 70 : 0);
        const y = pulled ? 210 : 214;
        return (
          <g key={i}>
            <rect x={x} y={y} width={78} height={60} class={`disk${pulled ? ' sc-pulled' : ''}`} />
            <text x={x + 39} y={y + 22} text-anchor="middle" class="mono" style={{ fontSize: '11px' }}>
              {sed ? 'SED' : 'SSD'}
            </text>
            <text x={x + 39} y={y + 44} text-anchor="middle" class={`mono ${enc0 ? 'ok-fill' : 'bad-fill'}`} style={{ fontSize: '11px', fontWeight: 600 }}>
              {enc0 ? '9f3a…c1' : 'payroll…'}
            </text>
          </g>
        );
      })}
      {driveOut && (
        <text x={nx + 30 + 560 + 70 + 39} y={296} text-anchor="middle" class={enc0 ? 'ok-fill' : 'bad-fill'} style={{ fontSize: '12px', fontWeight: 600 }}>
          {enc0 ? 'removed: unreadable' : 'removed: readable'}
        </text>
      )}
      <path d={`M${nx + 365} 142 V 200`} class="flow-stroke" stroke-width={2} />
      <text x={nx + 375} y={178} class="muted" style={{ fontSize: '11px' }}>
        {enc0 ? 'ciphertext on media' : 'plain data on media'}
      </text>
      <text x={nx + 30} y={200} class="muted" style={{ fontSize: '11px' }}>
        local drives
      </text>
      {/* key manager */}
      {enc0 && (
        <g>
          {km === 'native' ? (
            <g>
              <rect x={nx + 300} y={150} width={180} height={34} class="ink-soft" stroke="var(--ink-line)" />
              <text x={nx + 390} y={172} text-anchor="middle" style={{ fontSize: '12px', fontWeight: 600 }}>
                native key manager
              </text>
            </g>
          ) : (
            <g>
              <rect x={680} y={40} width={160} height={60} class="ink-soft" stroke="var(--ink-line)" />
              <text x={760} y={64} text-anchor="middle" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                External KMS
              </text>
              <text x={760} y={84} text-anchor="middle" class="muted" style={{ fontSize: '11px' }}>
                your key server
              </text>
              <path d={`M680 70 H${nx + 480}`} class={nodeOut ? 'sc-keyline cut' : 'sc-keyline'} />
              {nodeOut && (
                <text x={(680 + nx + 480) / 2} y={62} text-anchor="middle" class="bad-fill halo" style={{ fontSize: '11px', fontWeight: 600 }}>
                  ✕ unreachable
                </text>
              )}
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

// ── hardening ──

const PROFILES: { id: Prof; label: string; adds: string[] }[] = [
  { id: 'standard', label: 'Standard', adds: ['Base level of hardening'] },
  { id: 'elevated', label: 'Elevated', adds: ['Key CPU vulnerability mitigations', 'High-strength password policies'] },
  { id: 'strict', label: 'Strict', adds: ['File integrity monitoring (AIDE)', 'Built for highly regulated environments'] },
];

function Hardening({ prof, setProf }: { prof: Prof; setProf: (p: Prof) => void }) {
  const DUR = 2 * 3600 + 900;
  const clock = useClock({ rate: 900, duration: DUR, stepSize: 900, keys: true });
  const t = clock.t;
  const driftAt = 1800;
  const checkAt = 7200;
  const drifted = t >= driftAt;
  const fixed = t >= checkAt;
  const level = PROFILES.findIndex((p) => p.id === prof);
  return (
    <div class="cols-2">
      <div>
        <p class="lede">
          In current releases (AOS 7.6 with Prism Central 7.6 and AHV 11.2), a security profile is applied from Prism Central across AOS and AHV. Each level adds to the one before.
        </p>
        <Field label="Security profile" tip="Applied cluster-wide from Prism Central. On hypervisors other than AHV, profiles apply to the AOS layer only." value={PROFILES[level].label}>
          <Seg label="Security profile" value={prof} onChange={setProf} options={PROFILES.map((p) => ({ value: p.id, label: p.label }))} />
        </Field>
        <table class="tbl">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Adds</th>
              <th class="num">Active</th>
            </tr>
          </thead>
          <tbody>
            {PROFILES.map((p, i) => (
              <tr key={p.id} class={i <= level ? 'sel' : ''}>
                <td>{p.label}</td>
                <td>{p.adds.join(' · ')}</td>
                <td class="num">{i <= level ? <span class="ok-text">✓ yes</span> : <span class="muted">no</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
          Some settings stay manual (for example syslog, network segmentation and LDAP). Nutanix also publishes a Security Technical Implementation Guide (STIG) for AOS, developed with DISA, and a security hardening guide.
        </p>
      </div>
      <div>
        <div class="spread">
          <h3 class="sc-h3">
            <Tip text="A built-in scheduled job checks the profile every 2 hours and puts drifted settings back where it can. Changes that need a reboot raise an alert for an administrator instead.">Configuration drift</Tip>
          </h3>
          <Illus why="Timing of the drift event is an example. The 2-hour check interval is from Nutanix's description of security profiles." />
        </div>
        <PlayBar clock={clock} label="Drift remediation timeline" />
        <svg class="diagram" viewBox="0 0 760 110" role="img" aria-label="Two-hour timeline: drift, detection, remediation">
          <line x1={20} x2={740} y1={55} y2={55} class="line" stroke-width={2} />
          <line x1={20} x2={20 + (Math.min(t, DUR) / DUR) * 720} y1={55} y2={55} class="flow-stroke" stroke-width={3} />
          {[
            { at: 0, l: 'profile compliant', c: 'ok' },
            { at: driftAt, l: 'someone weakens a setting', c: 'warn' },
            { at: checkAt, l: '2-hour check: put back', c: 'ok' },
          ].map((m) => {
            const x = 20 + (m.at / DUR) * 720;
            const on = t >= m.at;
            return (
              <g key={m.l}>
                <circle cx={x} cy={55} r={7} class={on ? `${m.c}-fill` : 'bg3'} stroke="var(--line-2)" />
                <text x={x} y={m.at === driftAt ? 32 : 86} text-anchor={m.at === 0 ? 'start' : m.at === checkAt ? 'end' : 'middle'} class={on ? '' : 'muted'} style={{ fontSize: '13px' }}>
                  {m.l}
                </text>
              </g>
            );
          })}
        </svg>
        <Follow tone={!drifted ? 'ok' : fixed ? 'ok' : 'warn'} k={!drifted ? 'Compliant' : fixed ? 'Remediated' : 'Drift present'}>
          <p>{!drifted ? 'All settings match the selected profile.' : fixed ? 'The scheduled check restored the setting. Anything that needs a reboot raises an NCC alert instead of rebooting by itself.' : 'A setting no longer matches the profile. It stays that way until the next scheduled check.'}</p>
        </Follow>
      </div>
    </div>
  );
}

// ── layers ──

const LAYERS: { k: string; t: string; s: string; path?: string; icon: string }[] = [
  { k: 'Configuration', t: 'Security profiles and STIG', s: 'Keep hosts and CVMs hardened, and put drifted settings back.', icon: 'shield' },
  { k: 'Data at rest', t: 'Encryption and key management', s: 'Drives and nodes that leave your control stay unreadable.', icon: 'lock' },
  { k: 'Traffic between VMs', t: 'Flow Network Security', s: 'Category-based microsegmentation and one-click quarantine limit lateral movement.', path: 'nci/flow', icon: 'net' },
  { k: 'File data', t: 'Data Lens', s: 'Ransomware-pattern detection and access auditing for file shares.', path: 'datalens', icon: 'eye' },
  { k: 'Recovery', t: 'Snapshots and disaster recovery', s: 'When something gets through, restore from a good recovery point.', path: 'nci/dr', icon: 'globe' },
];

function Layers() {
  return (
    <>
      <div class="sc-layers">
        {LAYERS.map((l) => {
          const inner = (
            <>
              <span class="sc-k">{l.k}</span>
              <span class="sc-t">
                <Icon name={l.icon} />
                {l.t}
              </span>
              <span class="sc-s">{l.s}</span>
              {l.path && (
                <span class="sc-go">
                  Open <Icon name="arrow" />
                </span>
              )}
            </>
          );
          return l.path ? (
            <button type="button" class="sc-layer" key={l.k} onClick={(e) => go(l.path!, undefined, e.currentTarget as HTMLElement)}>
              {inner}
            </button>
          ) : (
            <div class="sc-layer" key={l.k}>
              {inner}
            </div>
          );
        })}
      </div>
      <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
        Each layer covers a different threat. Encryption does not stop an attacker inside a VM; microsegmentation does not protect a stolen drive. Use them together.
      </p>
    </>
  );
}
