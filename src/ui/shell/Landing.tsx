// The landing page: a live version of the "One Platform For All Apps, Data & AI Anywhere"
// slide. Every pane is a button that opens its module; the clicked pane grows into the
// module header (View Transitions where the browser supports them).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { go } from './nav';

interface PaneDef {
  id: string;
  title: string;
  sub?: string;
  path: string;
  params?: Record<string, string>;
}

const CENTRAL: PaneDef[] = [
  { id: 'fed', title: 'Prism Federation', sub: 'API | Alerts | LCM | IAM', path: 'central', params: { tab: 'fed' } },
  { id: 'ncm', title: 'Cloud Manager', sub: 'AIOps | Self-Service | Cost | SecOps', path: 'ncm' },
  { id: 'nkp', title: 'Kubernetes Platform', sub: 'LCM | Fleet Management | Security', path: 'nkp' },
  { id: 'lens', title: 'Data Lens', sub: 'Security | Privacy', path: 'datalens' },
];

const SERVICES: PaneDef[] = [
  { id: 'files', title: 'Files, Objects', path: 'storage' },
  { id: 'cnaos', title: 'Cloud Native AOS', path: 'cnaos' },
  { id: 'ndb', title: 'Database Service', path: 'ndb' },
  { id: 'ai', title: 'Enterprise AI', path: 'ai' },
];

// For customers who want part of the platform: AHV with their own array, or Nutanix HCI under ESXi.
const PARTIAL: PaneDef[] = [
  { id: 'ext', title: 'Nutanix with external storage', sub: 'AHV and Prism on your own storage array', path: 'partial', params: { tab: 'ext' } },
  { id: 'esxi', title: 'ESXi on Nutanix', sub: 'Keep vSphere and vCenter, run them on Nutanix', path: 'partial', params: { tab: 'esxi' } },
];

const CLOUDS: PaneDef[] = [
  { id: 'aws', title: 'AWS', path: 'cloud', params: { c: 'aws' } },
  { id: 'azure', title: 'Azure', path: 'cloud', params: { c: 'azure' } },
  { id: 'gcp', title: 'Google Cloud', path: 'cloud', params: { c: 'gcp' } },
];

interface TourStep {
  sel: string;
  title: string;
  text: string;
}

// Bottom-up talk order: infrastructure, then services, then the management layer.
const TOUR: TourStep[] = [
  { sel: 'nci', title: 'Start with the foundation', text: 'Nutanix Cloud Infrastructure turns ordinary servers into one cluster: the AHV hypervisor, a storage controller on every node, networking and security (Flow) and disaster recovery.' },
  { sel: 'clouds', title: 'The same stack in public cloud', text: 'The platform also runs in public clouds, so the same operating model covers data center and cloud. Which offering applies differs by provider.' },
  { sel: 'bare', title: 'Or on any bare-metal Linux', text: 'Container-native Nutanix services can also run directly on Kubernetes on bare-metal Linux, without a hypervisor.' },
  { sel: 'services', title: 'Data and AI services on top', text: 'File, object and block storage, databases as a service and AI inference all run on the same platform, so they share its resilience, protection and management.' },
  { sel: 'central', title: 'One control plane across everything', text: 'Nutanix Central sits above many clusters and sites: fleet management, operations, Kubernetes and data security from one place.' },
];

function Pane({ p, cls, tour, children }: { p: PaneDef; cls?: string; tour?: string; children?: preact.ComponentChildren }) {
  return (
    <button type="button" class={`pane${cls ? ` ${cls}` : ''}`} data-tour={tour} data-pane={p.id} onClick={(e) => go(p.path, p.params, e.currentTarget as HTMLElement)}>
      {children ?? (
        <>
          <span class="pt">{p.title}</span>
          {p.sub && <span class="ps">{p.sub}</span>}
        </>
      )}
      <span class="pmore" aria-hidden="true">
        Open →
      </span>
    </button>
  );
}

export function Landing() {
  const [tour, setTour] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    root.querySelectorAll('.spot').forEach((el) => el.classList.remove('spot'));
    if (tour === null) return;
    const el = root.querySelector(`[data-tour="${TOUR[tour].sel}"]`) as HTMLElement | null;
    if (el) {
      el.classList.add('spot');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [tour]);

  useEffect(() => {
    if (tour === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTour(null);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'ArrowRight') setTour((t) => (t === null ? t : Math.min(TOUR.length - 1, t + 1)));
      else if (e.key === 'ArrowLeft') setTour((t) => (t === null ? t : Math.max(0, t - 1)));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour]);

  const step = tour !== null ? TOUR[tour] : null;
  return (
    <div class={`slide-wrap${tour !== null ? ' tour-on' : ''}`} ref={wrap}>
      <div class="slide">
        <h1 class="slide-title">One Platform For All Apps, Data &amp; AI Anywhere</h1>
        <div class="slide-actions">
          <button type="button" class="btn primary" onClick={() => setTour(0)}>
            <Icon name="compass" />
            Guided tour
          </button>
          <button type="button" class="btn" onClick={(e) => go('nci/cluster', undefined, e.currentTarget as HTMLElement)}>
            <Icon name="server" />
            Open the Cluster Lab
          </button>
        </div>

        <section class="band central" data-tour="central" aria-label="Nutanix Central">
          <button type="button" class="central-head" data-pane="central" onClick={(e) => go('central', undefined, e.currentTarget as HTMLElement)}>
            Nutanix Central
          </button>
          <div class="central-grid">
            {CENTRAL.map((p) => (
              <Pane key={p.id} p={p} />
            ))}
          </div>
        </section>

        <div class="flowline" aria-hidden="true" />

        <section class="band svc-row" data-tour="services" aria-label="Platform services">
          {SERVICES.map((p) => (
            <Pane key={p.id} p={p} />
          ))}
          <button type="button" class="beacon" data-pane="beacon" onClick={(e) => go('beacon', undefined, e.currentTarget as HTMLElement)}>
            <Icon name="beacon" />
            Project Beacon
          </button>
        </section>

        <div class="flowline" aria-hidden="true" />

        <section class="band infra-row" aria-label="Infrastructure">
          <Pane p={{ id: 'nci', title: 'Nutanix Cloud Infrastructure', sub: '(AOS, AHV, Flow, DR)', path: 'nci' }} cls="nci" tour="nci" />
          <div class="gray clouds" data-tour="clouds">
            {CLOUDS.map((p) => (
              <Pane key={p.id} p={p}>
                <Icon name="cloud" class="cloud-glyph" />
                <span class="cloud-mark">{p.title}</span>
              </Pane>
            ))}
          </div>
          <Pane p={{ id: 'bare', title: 'Any Bare Metal Linux', path: 'cnaos', params: { on: 'metal' } }} cls="bare" tour="bare">
            <Icon name="server" />
            <span class="pt">Any Bare Metal Linux</span>
          </Pane>
        </section>

        <section class="band partial" aria-label="Don’t want the full stack?">
          <button type="button" class="partial-head" data-pane="partial" onClick={(e) => go('partial', undefined, e.currentTarget as HTMLElement)}>
            <span class="pt">Don’t want the full stack?</span>
            <span class="ps">Start with the part you need</span>
          </button>
          {PARTIAL.map((p) => (
            <Pane key={p.id} p={p} />
          ))}
        </section>

        <p class="slide-hint">
          Click any pane to see how it works. Press <kbd>?</kbd> for shortcuts and <kbd>P</kbd> for presenter notes.
        </p>
      </div>

      {step && tour !== null && (
        <div class="tour-card" role="dialog" aria-label="Guided tour" aria-live="polite">
          <div class="eyebrow">
            Guided tour <span class="n">{tour + 1} / {TOUR.length}</span>
          </div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
          <div class="hstack">
            <button type="button" class="tbtn" onClick={() => setTour(null)}>
              End tour
            </button>
            <span class="spacer" />
            <button type="button" class="btn" disabled={tour === 0} onClick={() => setTour(tour - 1)}>
              Back
            </button>
            {tour < TOUR.length - 1 ? (
              <button type="button" class="btn primary" onClick={() => setTour(tour + 1)}>
                Next
              </button>
            ) : (
              <button
                type="button"
                class="btn primary"
                onClick={() => {
                  setTour(null);
                  go('nci');
                }}
              >
                Open NCI
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
