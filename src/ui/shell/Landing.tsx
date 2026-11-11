// The home page (Nutanix 2.0, N2-020): the platform as a labeled stack, top to bottom: what manages
// it, the data and AI services, the infrastructure, and where it runs, with "Start smaller" as a
// separate strip. Every card opens its module and says what you will see there; the clicked card
// grows into the module header (View Transitions where the browser supports them).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { prefersReducedMotion } from '../components/clock';
import { Icon } from '../components/Icon';
import awsLogo from '../../assets/logos/aws.svg';
import azureLogo from '../../assets/logos/azure.svg';
import googleCloudLogo from '../../assets/logos/google-cloud-icon.svg';
import { Logo, type Vendor } from '../components/logos';
import { findModule } from '../modules/registry';
import { go } from './nav';

interface Card {
  id: string;
  title: string;
  /** What you will see when you open it. */
  see: string;
  path: string;
  params?: Record<string, string>;
  tag?: string;
}

const MANAGE: Card[] = [
  { id: 'fed', title: 'Prism Federation', see: 'Many clusters and regions in one console', path: 'central', params: { tab: 'fed' } },
  { id: 'ncm', title: 'Cloud Manager', see: 'Anomalies, self-service, cost and compliance', path: 'ncm' },
  { id: 'nkp', title: 'Kubernetes Platform', see: 'Kubernetes clusters run one consistent way', path: 'nkp' },
  { id: 'lens', title: 'Data Lens', see: 'Ransomware stopped on file shares; cold data tiered', path: 'datalens' },
];

const SERVICES: Card[] = [
  { id: 'files', title: 'Files, Objects', see: 'Files, volumes and S3 objects on the same cluster', path: 'storage' },
  { id: 'cnaos', title: 'Cloud Native AOS', see: 'Nutanix storage inside Kubernetes, no hypervisor', path: 'cnaos' },
  { id: 'ndb', title: 'Database Service', see: 'Databases built, cloned and recovered to the minute', path: 'ndb' },
  { id: 'ai', title: 'Enterprise AI', see: 'Private model endpoints and an agent gateway', path: 'ai' },
  { id: 'beacon', title: 'Project Beacon', see: 'The run-anywhere direction behind these services', path: 'beacon', tag: 'Vision' },
];

const OEMS: Vendor[] = ['Nutanix', 'Dell', 'HPE', 'Lenovo', 'Cisco', 'Fujitsu', 'Supermicro'];

const CLOUDS = [
  { id: 'aws', title: 'AWS', src: awsLogo },
  { id: 'azure', title: 'Azure', src: azureLogo },
  { id: 'gcp', title: 'Google Cloud', src: googleCloudLogo },
];

// For customers who want part of the platform: AHV with their own array, or Nutanix HCI under ESXi.
const PARTIAL: Card[] = [
  { id: 'ext', title: 'Nutanix with external storage', see: 'AHV and Prism on the storage array you own', path: 'partial', params: { tab: 'ext' } },
  { id: 'esxi', title: 'ESXi on Nutanix', see: 'Keep vSphere and vCenter, run them on Nutanix', path: 'partial', params: { tab: 'esxi' } },
];

interface TourStep {
  sel: string;
  title: string;
  text: string;
}

// Bottom-up talk order: infrastructure, then services, then the management layer.
const TOUR: TourStep[] = [
  { sel: 'nci', title: 'Start with the foundation', text: 'Nutanix Cloud Infrastructure turns ordinary servers into one cluster: the AHV hypervisor, a storage controller on every node, networking and security (Flow) and disaster recovery.' },
  { sel: 'partial', title: 'Or start with the part you need', text: 'Customers can keep an external storage array under AHV and Prism, or keep vSphere and vCenter and run ESXi on Nutanix nodes, then grow into the rest of the platform.' },
  { sel: 'clouds', title: 'The same stack in public cloud', text: 'The platform also runs in public clouds, so the same operating model covers data center and cloud. Which offering applies differs by provider.' },
  { sel: 'bare', title: 'On the OEM of your choice', text: 'Nutanix is software, so the hardware is your choice: Nutanix NX, or OEM platforms from Dell, HPE, Lenovo, Cisco, Fujitsu and Supermicro, or servers you already own. The platform runs the same on every one.' },
  { sel: 'services', title: 'Data and AI services on top', text: 'File, object and block storage, databases as a service and AI inference all run on the same platform, so they share its resilience, protection and management.' },
  { sel: 'central', title: 'One control plane across everything', text: 'Nutanix Central sits above many clusters and sites: fleet management, operations, Kubernetes and data security from one place.' },
];

const EDGE = 24; // the card's distance from the screen edge or the top bar
const GAP = 16; // room kept between the card and the part it describes

/**
 * Where the tour card goes and where the page scrolls to, so the card covers as little of the
 * spotlit part as possible: the bottom of the screen unless the top hides less (the part sits at
 * the end of the page, say). A part too tall to fit shows its top, where its heading is.
 */
function placeCard(spot: DOMRect, cardH: number, barH: number) {
  const h = innerHeight;
  const top = spot.top + scrollY;
  const max = Math.max(0, document.documentElement.scrollHeight - h);
  const options = [
    { cardTop: h - EDGE - cardH, lo: barH + GAP, hi: h - EDGE - cardH - GAP },
    { cardTop: barH + EDGE, lo: barH + EDGE + cardH + GAP, hi: h - GAP },
  ].map((o) => {
    const room = o.hi - o.lo;
    const scroll = Math.round(Math.max(0, Math.min(max, top - o.lo - Math.max(0, (room - spot.height) / 2))));
    const shown = top - scroll;
    return { cardTop: Math.round(o.cardTop), scroll, hidden: Math.max(0, o.lo - shown) + Math.max(0, shown + spot.height - o.hi) };
  });
  return options[1].hidden < options[0].hidden ? options[1] : options[0];
}

function CardBtn({ c, tour, children }: { c: Card; tour?: string; children?: preact.ComponentChildren }) {
  const icon = findModule(c.path)?.icon ?? 'layers';
  return (
    <button type="button" class="hm-card" data-tour={tour} data-pane={c.id} data-path={c.path} onClick={(e) => go(c.path, c.params, e.currentTarget as HTMLElement)}>
      <span class="hm-ic" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span class="hm-t">
        {c.title}
        {c.tag && <span class="hm-tag">{c.tag}</span>}
      </span>
      <span class="hm-see">{c.see}</span>
      {children}
    </button>
  );
}

function Band({ label, tour, children, cls }: { label: string; tour?: string; children: preact.ComponentChildren; cls?: string }) {
  return (
    <section class={`hm-band${cls ? ` ${cls}` : ''}`} data-tour={tour} aria-label={label}>
      <h2 class="hm-label">{label}</h2>
      <div class="hm-row">{children}</div>
    </section>
  );
}

export function Landing() {
  const [tour, setTour] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // Before paint, so the card never shows over the part it is about to describe.
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    root.querySelectorAll('.spot').forEach((el) => el.classList.remove('spot'));
    if (tour === null) return;
    const el = root.querySelector(`[data-tour="${TOUR[tour].sel}"]`) as HTMLElement | null;
    if (!el) return;
    el.classList.add('spot');
    const place = (behavior: ScrollBehavior, scroll = true) => {
      const c = card.current;
      if (!c) return;
      const at = placeCard(el.getBoundingClientRect(), c.offsetHeight, document.querySelector('.bar')?.getBoundingClientRect().bottom ?? 0);
      c.style.top = `${at.cardTop}px`;
      c.style.bottom = 'auto';
      if (scroll) window.scrollTo({ top: at.scroll, behavior });
    };
    place(prefersReducedMotion() ? 'auto' : 'smooth');
    // Phones resize the window as the address bar hides and shows while the visitor scrolls, so only a
    // width change scrolls the page back to the part; the card always moves to fit the new height.
    let width = innerWidth;
    const onResize = () => {
      place('auto', innerWidth !== width);
      width = innerWidth;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
      <div class="hm">
        <div class="hm-head">
          <h1 class="hm-title">One platform for all apps, data and AI, anywhere</h1>
          {tour === null && (
            <button type="button" class="btn tour-btn" onClick={() => setTour(0)}>
              <Icon name="compass" />
              Take the tour
            </button>
          )}
        </div>

        <div class="hm-stack">
          <Band label="Manage" tour="central">
            <div class="hm-grid four">
              {MANAGE.map((c) => (
                <CardBtn key={c.id} c={c} />
              ))}
            </div>
            <button type="button" class="hm-more" data-pane="central" data-path="central" onClick={(e) => go('central', undefined, e.currentTarget as HTMLElement)}>
              Nutanix Central runs these across every cluster →
            </button>
          </Band>
          <Band label="Data and AI services" tour="services">
            <div class="hm-grid five">
              {SERVICES.map((c) => (
                <CardBtn key={c.id} c={c} />
              ))}
            </div>
          </Band>
          <Band label="Infrastructure">
            <div class="hm-grid one">
              <CardBtn c={{ id: 'nci', title: 'Nutanix Cloud Infrastructure', see: 'AOS, AHV, Flow and DR: watch a node fail and the cluster heal itself', path: 'nci' }} tour="nci" />
            </div>
          </Band>
          <Band label="Runs on">
            <div class="hm-grid two">
              <button type="button" class="hm-card hm-clouds" data-tour="clouds" data-pane="clouds" data-path="cloud" onClick={(e) => go('cloud', undefined, e.currentTarget as HTMLElement)}>
                <span class="hm-t">Public cloud · NC2</span>
                <span class="hm-see">Nutanix Cloud Clusters in your cloud account</span>
                <span class="hm-logos">
                  {CLOUDS.map((c) => (
                    <span key={c.id} class="hm-logo">
                      <img src={c.src} alt={c.title} />
                    </span>
                  ))}
                </span>
              </button>
              <CardBtn c={{ id: 'bare', title: 'OEM of your choice', see: 'Nutanix NX and six OEM hardware platforms', path: 'oem' }} tour="bare">
                <span class="hm-marks">
                  {OEMS.map((v) => (
                    <Logo key={v} vendor={v} size="table" />
                  ))}
                </span>
              </CardBtn>
            </div>
          </Band>
        </div>

        <Band label="Start smaller" tour="partial" cls="hm-partial">
          <div class="hm-grid two">
            {PARTIAL.map((c) => (
              <CardBtn key={c.id} c={c} />
            ))}
          </div>
        </Band>

        <p class="hm-hint">
          Click any card to see how it works. Press <kbd>?</kbd> for shortcuts and <kbd>P</kbd> for presenter notes.
        </p>
      </div>

      {step && tour !== null && (
        <div class="tour-card" ref={card} role="dialog" aria-label="Guided tour" aria-live="polite">
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
                Open Nutanix Cloud Infrastructure
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
