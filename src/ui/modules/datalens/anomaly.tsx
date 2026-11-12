// Data Lens, Unusual activity tab: one day of operations on a share by three users. A fixed threshold
// alerts on normal busy work and misses a mass delete; user behavior analytics (UBA) judges each user
// against their own learned normal, and a monitoring schedule and an exclusion handle the rest.
// The arithmetic is in engine/anomaly.ts; claims are in docs/facts.md (DLA-1 to DLA-4).
import { Story, type StoryStep } from '../ai/kit';
import { HOURS, RULE, USERS, band, flag, hourOf, type User } from '../../../engine/anomaly';

const AT = [0, 7.5, 11.5, 15.5, 20.5];
const STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'One fixed rule for everyone',
    text: 'A fixed anomaly rule counts operations: here, more than 1,000 by one user in an hour on \\\\finance. Ana’s ordinary busy hours and the nightly backup cross it again and again, while Ben’s 600 deletes stay under it.',
  },
  {
    tone: 'ink',
    k: 'Learning each user’s normal',
    text: 'With user behavior analytics (UBA), Data Lens spends a 30-day warmup learning each user’s normal, separately for each kind of operation (creates, reads, deletes) on each share. The shaded band is that normal.',
  },
  { tone: 'ok', k: 'Busy is not unusual', text: 'In the workday each user is judged against their own normal, not one number for everyone. 1,400 reads an hour is normal for Ana, so those alerts go away.' },
  {
    tone: 'warn',
    k: 'Ben’s deletes flagged',
    text: 'Ben usually deletes about 15 files an hour. 600 in one hour is 40 times that, past the deviation percentage and above the minimum count you set, so Data Lens raises an anomaly for Ben on \\\\finance.',
  },
  {
    tone: 'ink',
    k: 'Schedules and exclusions',
    text: 'You choose when each method watches: here UBA runs in the workday and the fixed rule after hours. The backup account is excluded, so its nightly reads raise nothing, while Ana reading 1,500 files at 23:00 still does.',
  },
];

const H = 300;
const X0 = 150;
const SW = 22;
const ROW = { top: 44, h: 64, gap: 14 };
const PANEL = { x: 700, y: 44, w: 260, h: 220 };
const xOf = (i: number) => X0 + i * SW;
const rowTop = (r: number) => ROW.top + r * (ROW.h + ROW.gap);
/** Log scale from 1 to 10,000 operations an hour. */
const yOf = (r: number, v: number) => rowTop(r) + ROW.h - (Math.log10(Math.max(v, 1)) / 4) * ROW.h;
const barAt = (i: number) => 0.4 + i * 0.27;
const BEN = USERS[1];
const SPIKE = BEN.v.indexOf(600);
const WD: [number, number] = [2, 12];

const mode = (t: number) => ({ uba: t >= AT[2], exclude: t >= AT[4] });
/** The alert shown for user u in hour i at time t: Ben's UBA flag is revealed one step after UBA takes over, with its own caption. */
function shown(u: User, i: number, t: number) {
  if (t < barAt(i)) return null;
  const f = flag(u, i, mode(t));
  return f === 'uba' && t < AT[3] ? null : f;
}
const count = (t: number) => USERS.reduce((n, u) => n + u.v.filter((_, i) => shown(u, i, t)).length, 0);
const caught = (t: number) => shown(BEN, SPIKE, t) === 'uba';

function rowNote(r: number, t: number, phase: number): { cls: string; text: string } | null {
  if (r === 0 && phase >= 2) return { cls: 'ok-fill', text: '✓ busy is her normal' };
  if (r === 1 && caught(t)) return { cls: 'warn-fill', text: '▲ 40× his normal' };
  if (r === 1 && t >= barAt(SPIKE)) return { cls: 'muted', text: 'under the 1,000 rule' };
  if (r === 2 && mode(t).exclude) return { cls: 'muted', text: 'excluded' };
  return null;
}

function Panel({ t, phase }: { t: number; phase: number }) {
  const cx = PANEL.x + 14;
  const n = count(t);
  const lines: { cls: string; text: string; bold?: boolean }[] =
    phase === 0
      ? [
          { cls: 'muted', text: 'Rule: over 1,000 operations' },
          { cls: 'muted', text: 'by one user in an hour' },
          { cls: n ? 'warn-fill' : 'muted', text: `${n} alert${n === 1 ? '' : 's'} so far`, bold: true },
          ...(t >= barAt(HOURS - 1) ? [{ cls: 'muted', text: 'most of them normal work' }] : []),
        ]
      : phase === 1
        ? [
            { cls: 'flow-fill', text: 'Learning each user’s normal', bold: true },
            { cls: 'muted', text: '30-day warmup, per user,' },
            { cls: 'muted', text: 'per operation, per share' },
          ]
        : phase === 2
          ? [
              { cls: 'muted', text: 'Workday: each user against' },
              { cls: 'muted', text: 'their own normal' },
              { cls: 'ok-fill', text: 'Ana’s busy hours: no alert', bold: true },
            ]
          : [
              { cls: 'warn-fill', text: '▲ Anomaly · ben', bold: true },
              { cls: '', text: '600 deletes in one hour' },
              { cls: 'muted', text: 'his normal: about 15' },
              { cls: 'muted', text: 'on \\\\finance, during the workday' },
            ];
  return (
    <g>
      <rect class="bg2" x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} stroke="var(--line-2)" />
      <rect class="ink-fill" x={PANEL.x} y={PANEL.y} width={PANEL.w} height={36} />
      <text class="d-title" x={cx} y={PANEL.y + 24} style={{ fill: '#fff', fontWeight: 600 }}>
        Data Lens · anomalies
      </text>
      {lines.map((l, k) => (
        <text key={k} class={`d-sub ${l.cls}`} x={cx} y={PANEL.y + 62 + k * 20} style={{ fontWeight: l.bold ? 600 : 400 }}>
          {l.text}
        </text>
      ))}
      {phase >= 4 && (
        <>
          <line x1={PANEL.x + 14} x2={PANEL.x + PANEL.w - 14} y1={PANEL.y + 168} y2={PANEL.y + 168} stroke="var(--line-2)" />
          <text class="d-sub" x={cx} y={PANEL.y + 188} style={{ fontWeight: 600 }}>
            {`Alerts today: ${n}`}
          </text>
          <text class="d-fine muted" x={cx} y={PANEL.y + 206}>
            after hours: fixed rule · svc-backup excluded
          </text>
        </>
      )}
    </g>
  );
}

export function Anomalies() {
  return (
    <Story
      steps={STEPS}
      at={AT}
      end={27}
      poster={26}
      label="Unusual activity"
      why="Example users, counts and settings on one share over one day. The band here is one range per user for the whole workday; Data Lens learns each user’s baseline per operation type and share over a 30-day warmup, and you tune the deviation percentage and minimum count. Behavior analytics is listed for Nutanix Files only; on-premises it is a Pro feature (Data Lens On-Prem 2.1)."
      legend={[
        { color: 'var(--s2)', label: 'Operations by the user in that hour' },
        { color: 'var(--flow)', label: 'The user’s learned normal (UBA)' },
        { color: 'var(--text)', dashed: true, label: 'Fixed rule: over 1,000 an hour' },
        { color: 'var(--warn)', label: 'Alert raised (▲)' },
      ]}
      kpis={(t) => {
        const m = mode(t);
        return [
          { k: 'Alerts today', v: count(t), sub: m.exclude ? 'UBA in the workday, rule after hours' : m.uba ? 'UBA in the workday' : 'fixed rule only', tone: count(t) ? 'warn' : undefined },
          { k: 'Ben’s 600 deletes', v: caught(t) ? 'Flagged' : t >= barAt(SPIKE) ? 'Missed' : '–', tone: caught(t) ? 'warn' : t >= barAt(SPIKE) ? 'bad' : undefined },
          { k: 'Baseline', v: t >= AT[1] ? '30 days' : 'None', sub: 'per user, operation and share' },
          { k: 'Accounts excluded', v: m.exclude ? 1 : 0, sub: m.exclude ? 'svc-backup' : undefined },
        ];
      }}
    >
      {(t, phase) => {
        const m = mode(t);
        const learned = t >= AT[1] ? 1 : 0;
        const night = t >= AT[4] ? 1 : 0;
        return (
          <svg
            class="diagram dl-svg"
            viewBox={`0 0 960 ${H}`}
            role="img"
            aria-label="One day of file operations on the finance share by three users. A fixed rule of 1,000 operations an hour alerts on Ana's normal busy hours and the nightly backup but misses Ben deleting 600 files. User behavior analytics learns each user's normal, clears Ana's busy hours and flags Ben's deletes; after hours the fixed rule still applies and the backup account is excluded."
          >
            <text class="d-fine muted" x={0} y={24}>
              operations an hour (log scale)
            </text>
            <g style={{ opacity: night }}>
              <rect class="da-night" x={xOf(WD[1])} y={ROW.top - 6} width={xOf(HOURS) - xOf(WD[1])} height={rowTop(2) + ROW.h - ROW.top + 12} />
              <text class="d-fine muted" x={(xOf(WD[1]) + xOf(HOURS)) / 2} y={30} text-anchor="middle">
                after hours · fixed rule
              </text>
            </g>
            <line x1={xOf(WD[0]) + 2} x2={xOf(WD[1]) - 2} y1={36} y2={36} stroke="var(--line-2)" />
            <text class={`d-fine ${phase >= 1 ? 'flow-fill' : 'muted'}`} x={(xOf(WD[0]) + xOf(WD[1])) / 2} y={30} text-anchor="middle" style={{ fontWeight: phase >= 1 ? 600 : 400 }}>
              {phase >= 1 ? 'workday · UBA' : 'workday'}
            </text>

            {USERS.map((u, r) => {
              const top = rowTop(r);
              const b = band(u);
              const note = rowNote(r, t, phase);
              const ruleY = yOf(r, RULE);
              return (
                <g key={u.id} style={{ opacity: r === 2 && m.exclude ? 0.45 : 1 }}>
                  <rect class="da-row" x={X0} y={top} width={xOf(HOURS) - X0} height={ROW.h} />
                  <text class="d-sub" x={0} y={top + 20} style={{ fontWeight: 600 }}>
                    {u.id}
                  </text>
                  <text class="d-fine muted" x={0} y={top + 38}>
                    {u.op} on \\finance
                  </text>
                  {note && (
                    <text class={`d-fine ${note.cls}`} x={0} y={top + 56} style={{ fontWeight: note.cls === 'muted' ? 400 : 600 }}>
                      {note.text}
                    </text>
                  )}
                  {u.v.map((v, i) => {
                    if (t < barAt(i) || v < 1) return null;
                    const y = yOf(r, v);
                    const on = shown(u, i, t);
                    const cx = xOf(i) + SW / 2;
                    return (
                      <g key={i}>
                        <rect class={`da-bar${on ? ' on' : ''}`} x={xOf(i) + 3} y={y} width={SW - 6} height={top + ROW.h - y} />
                        {on && <polygon class="da-flag" points={`${cx - 6},${y - 3} ${cx + 6},${y - 3} ${cx},${y - 13}`} />}
                      </g>
                    );
                  })}
                  {b && learned > 0 && <rect class="da-band" x={xOf(WD[0])} y={yOf(r, b[1])} width={xOf(WD[1]) - xOf(WD[0])} height={yOf(r, b[0]) - yOf(r, b[1])} style={{ opacity: learned }} />}
                  {/* the fixed rule: everywhere at first, then only after hours once UBA takes the workday */}
                  <line class="da-rule" x1={m.uba ? xOf(WD[1]) : X0} x2={xOf(HOURS)} y1={ruleY} y2={ruleY} />
                  {m.uba && <line class="da-rule" x1={X0} x2={xOf(WD[0])} y1={ruleY} y2={ruleY} />}
                </g>
              );
            })}

            {[0, 6, 12, 18, 24].map((i) => (
              <text key={i} class="d-fine muted" x={xOf(i)} y={rowTop(2) + ROW.h + 18} text-anchor="middle">
                {String(hourOf(i % HOURS)).padStart(2, '0')}:00
              </text>
            ))}
            <Panel t={t} phase={phase} />
          </svg>
        );
      }}
    </Story>
  );
}
