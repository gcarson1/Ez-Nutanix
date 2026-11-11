// Kubernetes Platform, Cluster lifecycle tab: upgrading one cluster (preflight checks, platform
// applications, control plane, then workers one at a time), and bringing NKP into a site with no
// internet (bundle, local registry, admission). Checks, versions and images are examples; claims are
// in docs/facts.md (NKP-19, NKP-20).
import type { ComponentChildren } from 'preact';
import { prog } from '../../components/show';
import { Box, Cross, Story, W, fly, pts, type Pt, type StoryStep } from '../ai/kit';
import { ClusterCard, Row, WK, Worker } from './parts';

// ── Upgrade one cluster ──────────────────────────────────────────────────────────────────────────
const UP_AT = [0, 4.5, 9, 15, 23];
const UP_STEPS: StoryStep[] = [
  { tone: 'ink', k: 'One cluster, one command', text: 'From NKP 2.19 a workload cluster is upgraded on its own, from the NKP UI or with a single command, once the management cluster is on the new release.' },
  { tone: 'flow', k: 'Preflight checks first', text: 'Before anything changes, preflight checks look for what would make the upgrade fail, such as a container registry that cannot be reached.' },
  {
    tone: 'flow',
    k: 'Platform applications, then Kubernetes',
    text: 'The workflow upgrades the platform applications before Kubernetes, cluster infrastructure and related add-ons. Then the control plane nodes move to the new Kubernetes version.',
  },
  { tone: 'flow', k: 'Workers, one at a time', text: 'Each worker is drained and replaced in turn. Its pods move to the other workers first, so the applications keep running the whole time.' },
  { tone: 'ok', k: 'Upgraded, and nothing stopped', text: 'Every node is on the new version and all six pods are still running. Rolling the same upgrade across a whole fleet is shown on LCM Rolling Upgrade.' },
];
const CHECKS = ['Registry reachable', 'Versions compatible', 'Nodes healthy'];
const UP = { check: (i: number) => 5.0 + i * 0.9, apps: [9.4, 11], cp: (i: number) => 11.6 + i * 1.0, drain: (i: number) => 15.4 + i * 2.4, back: (i: number) => 17.0 + i * 2.4 };
const STAGES = ['Preflight checks', 'Platform applications', 'Control plane', 'Workers'];
const stageX = (i: number) => 16 + i * 232;
/** Pods on each worker as the workers are drained in turn: six in total, all the time. */
function podsAt(t: number): number[] {
  const p = [2, 2, 2];
  const move = (from: number, f: number) => {
    const n = Math.round(p[from] * f);
    const others = [0, 1, 2].filter((k) => k !== from).sort((a, b) => p[a] - p[b]);
    for (let k = 0; k < n; k++) p[others[k % 2]]++;
    p[from] -= n;
  };
  for (let i = 0; i < 3; i++) if (t >= UP.drain(i)) move(i, prog(t, UP.drain(i), UP.drain(i) + 1));
  return p;
}

export function UpgradeScene({ top, side }: { top: ComponentChildren; side: ComponentChildren }) {
  return (
    <Story
      steps={UP_STEPS}
      at={UP_AT}
      end={28}
      poster={27}
      label="Upgrading a cluster"
      top={top}
      side={side}
      why="Example versions and example preflight checks, with times compressed. Per-cluster upgrades in NKP 2.19 are for ClusterClass workload clusters, including Nutanix and EKS clusters NKP created."
      legend={[
        { color: 'var(--flow)', label: 'Running pod' },
        { color: 'var(--ink)', label: 'On the new version' },
      ]}
      kpis={(t) => {
        const cp = [0, 1, 2].filter((i) => t >= UP.cp(i)).length;
        const wk = [0, 1, 2].filter((i) => t >= UP.back(i)).length;
        return [
          { k: 'Preflight checks passed', v: `${CHECKS.filter((_, i) => t >= UP.check(i)).length} of 3` },
          { k: 'Nodes on Kubernetes 1.36', v: `${cp + wk} of 6`, tone: cp + wk === 6 ? 'ok' : undefined },
          { k: 'Pods running', v: '6 of 6', tone: 'ok', sub: 'throughout the upgrade' },
          { k: 'Started with', v: 'One command', sub: 'or the NKP UI' },
        ];
      }}
    >
      {(t, phase) => {
        const stage = [t >= UP.check(2) ? 2 : phase >= 1 ? 1 : 0, t >= UP.apps[1] ? 2 : t >= UP.apps[0] ? 1 : 0, t >= UP.cp(2) ? 2 : t >= UP.cp(0) - 0.6 ? 1 : 0, t >= UP.back(2) ? 2 : t >= UP.drain(0) ? 1 : 0];
        const pods = podsAt(t);
        const cpDone = [0, 1, 2].filter((i) => t >= UP.cp(i)).length;
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 312`}
            role="img"
            aria-label="One cluster is upgraded in four stages: preflight checks, platform applications, the control plane, then the workers one at a time while their pods move to the other workers, so all six pods keep running."
          >
            {STAGES.map((s, i) => (
              <g key={s}>
                <rect class={`nk-chip${stage[i] === 2 ? ' ok' : ''}${stage[i] === 1 ? ' now' : ''}`} x={stageX(i)} y={16} width={216} height={44} rx={5} />
                <text class="d-label" x={stageX(i) + 12} y={35} style={{ fontWeight: 600 }}>
                  {i + 1}. {s}
                </text>
                <text class={`d-fine ${stage[i] === 2 ? 'ok-fill' : stage[i] === 1 ? 'flow-fill' : 'muted'}`} x={stageX(i) + 12} y={51} style={{ fontWeight: stage[i] ? 600 : 400 }}>
                  {stage[i] === 2 ? '✓ done' : stage[i] === 1 ? '● in progress' : 'not started'}
                </text>
              </g>
            ))}
            <rect class="nk-isl" x={16} y={76} width={928} height={220} rx={6} />
            <text class="d-label" x={32} y={100} style={{ fontWeight: 600 }}>
              retail-prod
            </text>
            <text class="d-sub muted" x={928} y={100} text-anchor="end">
              {t >= UP.back(2) ? 'Kubernetes 1.36 on every node' : 'Kubernetes 1.35 → 1.36'}
            </text>
            {CHECKS.map((c, i) => (
              <Row key={c} x={32} y={134 + i * 22} label={c} on={t >= UP.check(i)} tone="ok" />
            ))}
            <rect class={`nk-chip${t >= UP.apps[1] ? ' ok' : ''}`} x={32} y={196} width={196} height={30} rx={4} />
            <text class={`d-fine ${t >= UP.apps[1] ? 'ok-fill' : 'muted'}`} x={42} y={215} style={{ fontWeight: t >= UP.apps[1] ? 600 : 400 }}>
              {t >= UP.apps[1] ? '✓ platform apps upgraded' : t >= UP.apps[0] ? '● platform apps upgrading' : 'platform apps'}
            </text>
            <text class="d-fine muted" x={32} y={250}>
              Control plane
            </text>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect class={`nk-node${t >= UP.cp(i) ? ' new' : ''}`} x={32 + i * 66} y={258} width={60} height={26} rx={4} />
                <text class={`d-fine${t >= UP.cp(i) ? ' ai-on-ink' : ''}`} x={62 + i * 66} y={275} text-anchor="middle">
                  {t >= UP.cp(i) ? '1.36' : '1.35'}
                </text>
              </g>
            ))}
            <text class="d-fine muted" x={270} y={126}>
              Workers {cpDone === 3 ? '' : '· wait for the control plane'}
            </text>
            {[0, 1, 2].map((i) => {
              const out = t >= UP.drain(i) && t < UP.back(i);
              const done = t >= UP.back(i);
              return <Worker key={i} x={270 + i * (WK.w + 16)} y={134} name={`worker-${i + 1}`} state={out ? 'new' : 'ok'} status={out ? 'being replaced' : done ? '✓ 1.36' : '1.35'} pods={pods[i]} />;
            })}
            <text class="d-sub ok-fill" x={270 + 3 * (WK.w + 16)} y={166} style={{ fontWeight: 600 }}>
              6 of 6 pods
            </text>
            <text class="d-sub ok-fill" x={270 + 3 * (WK.w + 16)} y={184} style={{ fontWeight: 600 }}>
              running
            </text>
          </svg>
        );
      }}
    </Story>
  );
}

// ── Air-gapped: bringing NKP into a site with no internet ────────────────────────────────────────
const AG_AT = [0, 5, 10, 15, 20];
const AG_STEPS: StoryStep[] = [
  { tone: 'warn', k: 'No way out to the internet', text: 'An isolated site cannot pull container images from public registries. Everything a cluster needs has to be brought in, and checked on the way.' },
  { tone: 'flow', k: 'One bundle carries it all', text: 'NKP supports air-gapped deployments. The release comes as an air-gapped bundle, downloaded once on a connected machine and carried across to the site.' },
  {
    tone: 'ink',
    k: 'A registry inside the site',
    text: 'The bundle’s images are loaded into a registry inside the site. NKP can run a highly available, Harbor-powered registry on the management cluster, as the mirror for the clusters it creates.',
  },
  { tone: 'ok', k: 'Clusters pull from the mirror', text: 'Clusters are created and upgraded from the local mirror with no connection outside. The registry also scans images for known vulnerabilities.' },
  {
    tone: 'bad',
    k: 'Only checked images run',
    text: 'An image that did not come through the registry is refused when someone tries to run it. Admission policy means what runs in the cluster is what was brought in and checked.',
  },
];
const AG = { carry: [5.5, 7.5], load: [10.4, 11.6], pull: [15.4, 16.2, 17.0], rogue: 20.6 };
const GAP_X = 330;
const CARRY: Pt[] = [
  [236, 150],
  [GAP_X, 150],
  [420, 150],
];
const PULL: Pt[] = [
  [640, 150],
  [700, 150],
];
const ROGUE: Pt[] = [
  [822, 242],
  [822, 204],
];

export function AirgapScene({ top, side }: { top: ComponentChildren; side: ComponentChildren }) {
  return (
    <Story
      steps={AG_STEPS}
      at={AG_AT}
      end={25}
      poster={24}
      label="Air-gapped deployment"
      top={top}
      side={side}
      why="Example images with times compressed. The Harbor-powered registry arrived in NKP 2.14 and is not supported on FIPS clusters; in an air-gapped site its vulnerability database is updated by hand. Which admission policies apply is your choice."
      legend={[
        { color: 'var(--ink)', label: 'Images from the bundle' },
        { color: 'var(--bad)', label: 'Refused' },
      ]}
      kpis={(t) => {
        const loaded = t >= AG.load[1];
        const pulled = AG.pull.filter((a) => t >= a + 0.7).length;
        return [
          { k: 'Connections to the internet', v: 0, sub: 'from the isolated site' },
          { k: 'Release in the local registry', v: loaded ? 'Loaded' : t >= AG.carry[1] ? 'On site' : 'Not yet', tone: loaded ? 'ok' : undefined },
          { k: 'Images pulled from the mirror', v: `${pulled} of 3`, tone: pulled === 3 ? 'ok' : undefined },
          { k: 'Images refused', v: t >= AG.rogue + 0.7 ? 1 : 0, tone: t >= AG.rogue + 0.7 ? 'bad' : undefined },
        ];
      }}
    >
      {(t, phase) => {
        const onSite = t >= AG.carry[1];
        const loaded = t >= AG.load[1];
        const pulled = AG.pull.filter((a) => t >= a + 0.7).length;
        const carry = fly(t, AG.carry[0], AG.carry[1], CARRY);
        const rogue = fly(t, AG.rogue, AG.rogue + 0.7, ROGUE);
        const refused = t >= AG.rogue + 0.7;
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 312`}
            role="img"
            aria-label="A site with no internet connection. The NKP air-gapped bundle is downloaded on a connected machine, carried across the gap and loaded into a registry inside the site. Clusters pull their images from that mirror, and an image that did not come through it is refused."
          >
            <text class="muted ai-cap" x={16} y={28}>
              Connected side
            </text>
            <Box x={16} y={40} w={220} h={64} t="Public registries" s="the internet" />
            <Box x={16} y={118} w={220} h={64} t="NKP air-gapped bundle" s="images and tools for the release" state={onSite ? 'carried across' : phase >= 1 ? 'downloaded once' : undefined} />
            <line class="nk-gap" x1={GAP_X} x2={GAP_X} y1={12} y2={300} />
            <text class="d-fine warn-fill" x={GAP_X + 8} y={28} style={{ fontWeight: 600 }}>
              ✕ no network across here
            </text>
            <text class="muted ai-cap" x={420} y={56}>
              Your isolated site
            </text>
            <rect class="ai-ep" x={420} y={68} width={220} height={164} rx={8} />
            <text class="ai-site-t" x={434} y={90}>
              Local registry
            </text>
            <text class="d-sub muted" x={434} y={108}>
              Harbor, on the management cluster
            </text>
            <Row x={434} y={140} label={loaded ? 'Release images loaded' : 'Empty'} on={loaded} tone="ok" />
            <Row x={434} y={166} label="Mirror for new clusters" on={phase >= 3} tone="ok" />
            <Row x={434} y={192} label="Scans for vulnerabilities" on={phase >= 3 && pulled > 0} tone="ok" />
            <Row x={434} y={218} label="Admits checked images only" on={refused} tone="bad" />
            <polyline points={pts(PULL)} class="ai-wire" />
            <ClusterCard
              x={700}
              y={114}
              w={244}
              h={72}
              name="retail-prod"
              sub="created from the mirror"
              status={pulled === 3 ? '✓ running' : pulled ? 'pulling images' : 'waiting'}
              tone={pulled === 3 ? 'ok' : undefined}
              cls={pulled === 3 ? 'ok' : ''}
            />
            <text class="d-fine muted" x={712} y={176}>
              {pulled} of 3 images pulled, none from outside
            </text>
            {phase === 4 && (
              <g>
                <Box
                  x={700}
                  y={242}
                  w={244}
                  h={56}
                  t="Image from somewhere else"
                  state={refused ? '✕ refused at admission' : 'someone tries to run it'}
                  tone={refused ? 'bad' : undefined}
                  cls={refused ? 'ai-box gw-down' : 'ai-box'}
                />
                {refused && <Cross x={822} y={204} />}
              </g>
            )}
            {carry && <rect class="nk-copy" x={carry[0] - 10} y={carry[1] - 10} width={20} height={20} rx={3} />}
            {fly(t, AG.load[0], AG.load[1], [
              [420, 150],
              [470, 150],
            ]) && <rect class="nk-copy" x={434} y={140} width={20} height={20} rx={3} style={{ opacity: 0.6 }} />}
            {AG.pull.map((a, i) => {
              const p = fly(t, a, a + 0.7, PULL);
              return p && <rect key={i} class="nk-copy" x={p[0] - 8} y={p[1] - 8} width={16} height={16} rx={3} />;
            })}
            {rogue && <rect class="nk-rogue" x={rogue[0] - 8} y={rogue[1] - 8} width={16} height={16} rx={3} />}
          </svg>
        );
      }}
    </Story>
  );
}
