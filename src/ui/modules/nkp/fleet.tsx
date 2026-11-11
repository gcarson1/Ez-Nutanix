// Kubernetes Platform, Fleet tab: workspaces with one sign-in, attaching a cluster NKP did not create,
// and GitOps delivery to every cluster. Teams, clusters and the app are examples; claims are in
// docs/facts.md (NKP-3, NKP-6, NKP-13 to NKP-15). Fleet management, GitOps and multitenancy are NKP Ultimate.
import type { ComponentChildren } from 'preact';
import { useEnum } from '../../../state/route';
import { Choice, prog } from '../../components/show';
import { Box, Cross, Story, W, fly, pts, type Pt, type StoryStep } from '../ai/kit';
import { ClusterCard, Row } from './parts';

// ── Workspaces and sign-in ───────────────────────────────────────────────────────────────────────
const WS_AT = [0, 5, 10, 16];
const WS_STEPS: StoryStep[] = [
  { tone: 'warn', k: 'Many clusters, many teams', text: 'Five clusters and two teams. Without grouping, every administrator sees every cluster, and who may change what has to be worked out cluster by cluster.' },
  {
    tone: 'ink',
    k: 'Workspaces group the clusters',
    text: 'A workspace holds the clusters assigned to one department or line of business. Retail’s three clusters and Finance’s two are now managed as two groups from one place.',
  },
  {
    tone: 'flow',
    k: 'One sign-in, your workspace',
    text: 'People sign in through the identity provider you already have: LDAP, SAML, OIDC or GitHub. Role-based access is set per workspace and per project, so the Retail team sees and manages Retail’s clusters.',
  },
  { tone: 'ok', k: 'Tenants stay apart', text: 'The Finance team signs in the same way and gets its own workspace. Its attempt to change a Retail cluster is refused. Multitenancy is built in, with NKP Ultimate.' },
];
const RETAIL = [
  { name: 'retail-prod', sub: 'Nutanix (AHV)' },
  { name: 'retail-edge', sub: 'VMware vSphere' },
  { name: 'retail-test', sub: 'Nutanix (AHV)' },
];
const FINANCE = [
  { name: 'fin-prod', sub: 'AWS' },
  { name: 'fin-test', sub: 'Nutanix (AHV)' },
];
const WS = { retail: { x: 306, w: 372 }, fin: { x: 694, w: 234 }, y: 68, h: 240 };
const TEAM_Y = [128, 216];
const signIn = (team: number): Pt[] => [
  [126, TEAM_Y[team]],
  [126, 88],
  [126, 88],
  [236, 60],
  [290, 60],
];
const WS_T = { retail: 10.5, fin: 16.4, try: 18.0 };
const TRY_PATH: Pt[] = [
  [236, TEAM_Y[1] + 28],
  [270, TEAM_Y[1] + 28],
  [270, 200],
  [WS.retail.x, 200],
];

function WorkspaceScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={WS_STEPS}
      at={WS_AT}
      end={22}
      poster={21}
      label="Workspaces and sign-in"
      top={top}
      why="Example teams and clusters with times compressed. Workspaces, projects and multitenancy are part of fleet management in NKP Ultimate."
      legend={[
        { color: 'var(--flow)', label: 'Sign-in or request' },
        { color: 'var(--ok)', label: 'Visible to the team signed in' },
        { color: 'var(--bad)', label: 'Refused' },
      ]}
      kpis={(t, phase) => [
        { k: 'Clusters', v: 5 },
        { k: 'Workspaces', v: phase >= 1 ? 2 : 0, sub: phase >= 1 ? 'Retail and Finance' : 'not grouped yet', tone: phase >= 1 ? 'ok' : 'warn' },
        { k: 'Signed in', v: t >= WS_T.fin + 1 ? 'Finance team' : t >= WS_T.retail + 1 ? 'Retail team' : 'Nobody yet', sub: t >= WS_T.retail + 1 ? 'through your identity provider' : undefined },
        { k: 'Requests refused', v: t >= WS_T.try + 1 ? 1 : 0, tone: t >= WS_T.try + 1 ? 'bad' : undefined },
      ]}
    >
      {(t, phase) => {
        const grouped = prog(t, WS_AT[1] + 0.4, WS_AT[1] + 1.4);
        const who = t >= WS_T.fin + 1 ? 'fin' : t >= WS_T.retail + 1 ? 'retail' : null;
        const refused = t >= WS_T.try + 1;
        const dotR = fly(t, WS_T.retail, WS_T.retail + 1, signIn(0));
        const dotF = fly(t, WS_T.fin, WS_T.fin + 1, signIn(1));
        const attempt = fly(t, WS_T.try, WS_T.try + 1, TRY_PATH);
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 326`}
            role="img"
            aria-label="Five clusters are grouped into two workspaces, Retail and Finance. Each team signs in through the company identity provider and sees only its own workspace; the Finance team's attempt to change a Retail cluster is refused."
          >
            <Box x={16} y={32} w={220} h={56} t="Your identity provider" s="LDAP, SAML, OIDC or GitHub" />
            <Box x={16} y={TEAM_Y[0]} w={220} h={56} t="Retail platform team" state={who === 'retail' ? '✓ signed in' : 'runs Retail’s clusters'} tone={who === 'retail' ? 'ok' : undefined} />
            <Box x={16} y={TEAM_Y[1]} w={220} h={56} t="Finance platform team" state={who === 'fin' ? '✓ signed in' : 'runs Finance’s clusters'} tone={who === 'fin' ? 'ok' : undefined} />
            <polyline points="236,60 290,60" class="ai-wire" />
            <rect class="ai-ep" x={290} y={16} width={654} height={302} rx={8} />
            <text class="ai-site-t" x={304} y={38}>
              NKP fleet management
            </text>
            <text class="d-sub muted" x={304} y={56}>
              {phase >= 2 ? 'one sign-in · roles per workspace and per project' : phase >= 1 ? 'clusters grouped into workspaces' : 'five clusters, not grouped'}
            </text>
            {[
              { k: 'retail', label: 'Workspace: Retail', box: WS.retail, list: RETAIL },
              { k: 'fin', label: 'Workspace: Finance', box: WS.fin, list: FINANCE },
            ].map((ws) => {
              const mine = who === ws.k;
              const hidden = who !== null && !mine;
              return (
                <g key={ws.k}>
                  <g style={{ opacity: grouped }}>
                    <rect class={`nk-ws${mine ? ' on' : ''}`} x={ws.box.x} y={WS.y} width={ws.box.w} height={WS.h} rx={6} />
                    <text class="d-label" x={ws.box.x + 12} y={WS.y + 22} style={{ fontWeight: 600 }}>
                      {ws.label}
                    </text>
                    {who !== null && (
                      <text class={`d-fine ${mine ? 'ok-fill' : 'muted'}`} x={ws.box.x + ws.box.w - 12} y={WS.y + 22} text-anchor="end" style={{ fontWeight: mine ? 600 : 400 }}>
                        {mine ? '✓ visible' : 'hidden'}
                      </text>
                    )}
                  </g>
                  {ws.list.map((c, i) => (
                    <ClusterCard key={c.name} x={ws.box.x + 12} y={WS.y + 32 + i * 64} w={ws.box.w - 24} name={c.name} sub={c.sub} cls={mine ? 'ok' : ''} dim={hidden} />
                  ))}
                </g>
              );
            })}
            {refused && (
              <g>
                <Cross x={WS.retail.x - 10} y={200} />
                <text class="d-sub bad-fill halo" x={WS.retail.x + 12} y={300} style={{ fontWeight: 600 }}>
                  Refused: Retail’s clusters are not in Finance’s workspace
                </text>
              </g>
            )}
            {[dotR, dotF, attempt].map((p, k) => p && <circle key={k} cx={p[0]} cy={p[1]} r={6} class="ai-req" />)}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Attach a cluster NKP did not create ──────────────────────────────────────────────────────────
const AT_AT = [0, 5, 10, 16];
const AT_STEPS: StoryStep[] = [
  {
    tone: 'warn',
    k: 'A cluster NKP did not create',
    text: 'Two clusters were created by NKP. A third, on Amazon EKS, was built in AWS with AWS’s own tools and sits outside the fleet, with its own view, policies and add-ons.',
  },
  { tone: 'flow', k: 'Attach it', text: 'An attached cluster is one created elsewhere and connected to NKP for application management. The workloads stay where they are, with nothing to migrate.' },
  { tone: 'ok', k: 'One view, one policy', text: 'The attached cluster now appears in the same fleet view as the others and receives the same platform applications and policies from the same control plane.' },
  {
    tone: 'ink',
    k: 'Its upgrades stay with its cloud',
    text: 'NKP upgrades Kubernetes on the clusters it created. The attached EKS cluster keeps taking its Kubernetes upgrades from AWS, so NKP manages what runs on it, not the cluster’s own lifecycle.',
  },
];
const FLEET = [
  { name: 'retail-prod', sub: 'Nutanix · created by NKP', nkp: true },
  { name: 'fin-prod', sub: 'AWS · created by NKP', nkp: true },
  { name: 'payments-eks', sub: 'Amazon EKS · created in AWS', nkp: false },
];
const cardY = (i: number) => 24 + i * 96;
const link = (i: number): Pt[] => [
  [266, 165],
  [340, 165],
  [340, cardY(i) + 36],
  [420, cardY(i) + 36],
];
const ATT = { attach: 5.5, policy: 10.5, upgrade: 16.5 };

function AttachScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={AT_STEPS}
      at={AT_AT}
      end={22}
      poster={21}
      label="Attaching a cluster"
      top={top}
      why="Example clusters and versions with times compressed. Attaching and managing Amazon EKS or Azure AKS clusters needs fleet management (NKP Ultimate) and the separate NKP Cloud Kubernetes SKU."
      legend={[
        { color: 'var(--ink)', label: 'Platform applications and policy from NKP' },
        { color: 'var(--flow)', label: 'Kubernetes upgrade from NKP' },
      ]}
      kpis={(t) => {
        const attached = t >= ATT.attach + 1;
        const policy = FLEET.filter((c, i) => (c.nkp || attached) && t >= ATT.policy + 1 + i * 0.3).length;
        const up = t >= ATT.upgrade + 1.6 ? 2 : 0;
        return [
          { k: 'Clusters in the fleet view', v: attached ? 3 : 2, tone: attached ? 'ok' : undefined },
          { k: 'Attached clusters', v: attached ? 1 : 0, sub: attached ? 'payments-eks' : undefined },
          { k: 'On the fleet’s policy', v: `${policy} of 3`, tone: policy === 3 ? 'ok' : undefined },
          { k: 'Upgraded by NKP', v: `${up} of 2`, sub: 'EKS upgrades stay with AWS' },
        ];
      }}
    >
      {(t, phase) => {
        const attached = t >= ATT.attach + 1;
        const linked = prog(t, ATT.attach, ATT.attach + 1);
        const hasPolicy = (i: number) => (FLEET[i].nkp || attached) && t >= ATT.policy + 1 + i * 0.3;
        const upgraded = (i: number) => FLEET[i].nkp && t >= ATT.upgrade + 1.2 + i * 0.4;
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 324`}
            role="img"
            aria-label="NKP manages two clusters it created. A third cluster, built on Amazon EKS, is attached: it joins the fleet view and gets the same policies and platform applications, while its Kubernetes upgrades stay with AWS."
          >
            <rect class="ai-ep" x={16} y={40} width={250} height={250} rx={8} />
            <text class="ai-site-t" x={30} y={62}>
              NKP management cluster
            </text>
            <text class="d-sub muted" x={30} y={80}>
              fleet management
            </text>
            <Row x={30} y={116} label="Creates and upgrades its own" on={phase === 3} />
            <Row x={30} y={144} label={attached ? 'Attached: payments-eks' : 'Attaches existing clusters'} on={phase === 1 && t >= ATT.attach} />
            <Row x={30} y={172} label="Platform apps and policy" on={phase === 2} tone="ok" />
            <Row x={30} y={200} label="One view of the fleet" on={phase >= 2} tone="ok" />
            {FLEET.map((c, i) => {
              const inFleet = c.nkp || attached;
              return (
                <g key={c.name}>
                  {(c.nkp || linked > 0) && <polyline points={pts(link(i))} class={`ai-wire${c.nkp ? '' : ' idle'}`} style={{ opacity: c.nkp ? 1 : linked }} />}
                  <ClusterCard
                    x={420}
                    y={cardY(i)}
                    w={524}
                    h={72}
                    name={c.name}
                    sub={c.sub}
                    cls={inFleet ? (hasPolicy(i) ? 'ok' : '') : 'out'}
                    status={inFleet ? (c.nkp ? 'in the fleet' : '✓ attached') : 'outside the fleet'}
                    tone={inFleet ? (c.nkp ? undefined : 'ok') : 'warn'}
                  />
                  <text class={`d-sub ${hasPolicy(i) ? 'ok-fill' : 'muted'}`} x={432} y={cardY(i) + 60} style={{ fontWeight: hasPolicy(i) ? 600 : 400 }}>
                    {hasPolicy(i) ? '✓ fleet policy and platform apps' : inFleet ? (c.nkp ? 'managed by NKP' : 'policy on its way') : 'its own policy and add-ons'}
                  </text>
                  <text class={`d-sub mono ${upgraded(i) ? 'ink-fill' : 'muted'}`} x={932} y={cardY(i) + 60} text-anchor="end" style={{ fontWeight: upgraded(i) ? 700 : 400 }}>
                    {c.nkp ? `Kubernetes ${upgraded(i) ? '1.36' : '1.35'}` : 'upgrades: by AWS'}
                  </text>
                </g>
              );
            })}
            {FLEET.map((c, i) => {
              const p = c.nkp || attached ? fly(t, ATT.policy + i * 0.3, ATT.policy + 1 + i * 0.3, link(i)) : null;
              const u = c.nkp ? fly(t, ATT.upgrade + i * 0.4, ATT.upgrade + 1.2 + i * 0.4, link(i)) : null;
              return (
                <g key={c.name}>
                  {p && <circle cx={p[0]} cy={p[1]} r={6} class="nk-dot" />}
                  {u && <circle cx={u[0]} cy={u[1]} r={6} class="ai-req" />}
                </g>
              );
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── GitOps delivery ──────────────────────────────────────────────────────────────────────────────
const GO_AT = [0, 5, 10, 16];
const GO_STEPS: StoryStep[] = [
  { tone: 'ink', k: 'The desired state lives in Git', text: 'What should run on the clusters is written down in a Git repository: here, version 1.4 of the shop application. All three clusters match it.' },
  {
    tone: 'flow',
    k: 'A change is a commit',
    text: 'A developer does not log in to any cluster. They merge a change to the repository, version 1.5, through the review they already use, and NKP’s GitOps, built on Flux, picks it up.',
  },
  { tone: 'ok', k: 'Every cluster follows', text: 'The change rolls out to each cluster in turn, with no per-cluster scripts. The repository’s history is the record of what changed, when, and who approved it.' },
  {
    tone: 'warn',
    k: 'Drift is put back',
    text: 'Someone edits one cluster by hand. It no longer matches the repository, so the change is reverted to what Git says. Configuration drift is prevented by enforcing the same state everywhere.',
  },
];
const GO = { commit: 5.4, pull: 6.0, roll: [10.4, 11.6, 12.8], drift: 16.5, fix: 18.4 };
const goY = (i: number) => 24 + i * 88;
const goLink = (i: number): Pt[] => [
  [530, 140],
  [564, 140],
  [564, goY(i) + 32],
  [600, goY(i) + 32],
];
const GIT_LINK: Pt[] = [
  [310, 140],
  [256, 140],
];
const GO_NAMES = ['retail-prod', 'retail-edge', 'retail-test'];

function GitOpsScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={GO_STEPS}
      at={GO_AT}
      end={23}
      poster={22}
      label="GitOps delivery"
      top={top}
      why="An example application and versions with times compressed. Reverting manual changes is how Flux keeps clusters matching the repository. GitOps is part of NKP Ultimate."
      legend={[
        { color: 'var(--flow)', label: 'A change from the repository' },
        { color: 'var(--warn)', label: 'Changed by hand' },
        { color: 'var(--ok)', label: 'Matches Git' },
      ]}
      kpis={(t) => {
        const target = t >= GO.commit ? '1.5' : '1.4';
        const rolled = GO.roll.filter((a) => t >= a + 0.9).length;
        const drift = t >= GO.drift && t < GO.fix + 0.9;
        const matching = t < GO.commit ? 3 : rolled - (drift ? 1 : 0);
        return [
          { k: 'Version in Git', v: `shop ${target}` },
          { k: 'Clusters matching Git', v: `${Math.max(0, matching)} of 3`, tone: drift ? 'warn' : matching === 3 ? 'ok' : undefined },
          { k: 'Manual changes put back', v: t >= GO.fix + 0.9 ? 1 : 0 },
          { k: 'Clusters logged in to', v: 0, sub: 'changes go through Git' },
        ];
      }}
    >
      {(t, phase) => {
        const committed = t >= GO.commit;
        const pull = fly(t, GO.pull, GO.pull + 0.7, GIT_LINK) ?? fly(t, GO.pull + 0.7, GO.pull + 1.4, GIT_LINK.slice().reverse() as Pt[]);
        const drift = t >= GO.drift && t < GO.fix + 0.9;
        const fix = fly(t, GO.fix, GO.fix + 0.9, goLink(1));
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 300`}
            role="img"
            aria-label="A Git repository holds the version of an application that should run. A new commit is picked up by NKP's GitOps and rolled out to three clusters in turn. A manual change on one cluster is reverted to match the repository."
          >
            <rect class="ai-box" x={16} y={40} width={240} height={200} rx={6} />
            <text class="d-label" x={28} y={62} style={{ fontWeight: 600 }}>
              Git repository
            </text>
            <text class="d-sub muted" x={28} y={80}>
              the desired state
            </text>
            {committed && (
              <g style={{ opacity: prog(t, GO.commit, GO.commit + 0.4) }}>
                <rect class="nk-chip ok" x={28} y={96} width={216} height={32} rx={4} />
                <text class="d-sub mono" x={38} y={117} style={{ fontWeight: 600 }}>
                  shop 1.5 · reviewed, merged
                </text>
              </g>
            )}
            <rect class="nk-chip" x={28} y={committed ? 136 : 96} width={216} height={32} rx={4} />
            <text class={`d-sub mono${committed ? ' muted' : ''}`} x={38} y={committed ? 157 : 117} style={{ fontWeight: committed ? 400 : 600 }}>
              shop 1.4{committed ? ' · previous' : ' · current'}
            </text>
            <polyline points={pts(GIT_LINK)} class="ai-wire" />
            <rect class="ai-ep" x={310} y={40} width={220} height={200} rx={8} />
            <text class="ai-site-t" x={324} y={62}>
              NKP GitOps
            </text>
            <text class="d-sub muted" x={324} y={80}>
              built on Flux
            </text>
            <Row x={324} y={116} label="Watches the repository" on={phase === 1 && t >= GO.pull} />
            <Row x={324} y={144} label="Applies it to every cluster" on={phase === 2} tone="ok" />
            <Row x={324} y={172} label="Puts back manual changes" on={phase === 3 && t >= GO.fix} tone="warn" />
            {GO_NAMES.map((name, i) => {
              const on15 = t >= GO.roll[i] + 0.9;
              const hand = i === 1 && drift;
              return (
                <g key={name}>
                  <polyline points={pts(goLink(i))} class="ai-wire" />
                  <ClusterCard
                    x={600}
                    y={goY(i)}
                    w={344}
                    h={64}
                    name={name}
                    sub={hand ? 'edited by hand on the cluster' : 'in the Retail workspace'}
                    cls={hand ? '' : 'ok'}
                    status={hand ? '✕ differs from Git' : `✓ shop ${on15 ? '1.5' : '1.4'}`}
                    tone={hand ? 'warn' : 'ok'}
                  />
                </g>
              );
            })}
            {pull && <circle cx={pull[0]} cy={pull[1]} r={6} class="ai-req" />}
            {GO.roll.map((a, i) => {
              const p = fly(t, a, a + 0.9, goLink(i));
              return p && <circle key={i} cx={p[0]} cy={p[1]} r={6} class="ai-req" />;
            })}
            {fix && <circle cx={fix[0]} cy={fix[1]} r={6} class="ai-req" />}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Fleet = 'ws' | 'attach' | 'gitops';
const FLEETS: { value: Fleet; label: string }[] = [
  { value: 'ws', label: 'Workspaces' },
  { value: 'attach', label: 'Attach a cluster' },
  { value: 'gitops', label: 'GitOps' },
];

export default function FleetView() {
  const [fleet, setFleet] = useEnum<Fleet>('f', 'ws', ['ws', 'attach', 'gitops']);
  const top = <Choice<Fleet> label="Fleet" value={fleet} onChange={setFleet} options={FLEETS} />;
  if (fleet === 'attach') return <AttachScene key="attach" top={top} />;
  if (fleet === 'gitops') return <GitOpsScene key="gitops" top={top} />;
  return <WorkspaceScene key="ws" top={top} />;
}
