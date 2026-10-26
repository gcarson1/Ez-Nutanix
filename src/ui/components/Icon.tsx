// Stroke icons from Lucide (lucide.dev, ISC license; notice in the About dialog), drawn at a
// 1.75 stroke on Lucide's 24-unit grid. Sized by CSS in rem; `size` is only a fallback.
import {
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Cloud,
  CodeXml,
  Compass,
  Copy,
  Cpu,
  Database,
  Eye,
  File,
  Gauge,
  Globe,
  HardDrive,
  Info,
  Keyboard,
  Layers,
  Lock,
  Mic,
  Moon,
  Move,
  Network,
  Pause,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShipWheel,
  Sparkles,
  Store,
  Sun,
  TriangleAlert,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-preact';

const I: Record<string, LucideIcon> = {
  back: ChevronLeft,
  play: Play,
  pause: Pause,
  book: BookOpen,
  podium: Mic,
  keyboard: Keyboard,
  sun: Sun,
  moon: Moon,
  info: Info,
  check: Check,
  ok: CircleCheck,
  x: X,
  bad: CircleX,
  warn: TriangleAlert,
  rebuild: RefreshCw,
  flow: Workflow,
  server: Server,
  cloud: Cloud,
  cpu: Cpu,
  db: Database,
  shield: Shield,
  net: Network,
  layers: Layers,
  zap: Zap,
  compass: Compass,
  plus: Plus,
  power: Power,
  disk: HardDrive,
  lock: Lock,
  upgrade: ArrowUpFromLine,
  move: Move,
  globe: Globe,
  clone: Copy,
  ai: Sparkles,
  k8s: ShipWheel,
  eye: Eye,
  beacon: Radio,
  edge: Store,
  gauge: Gauge,
  file: File,
  api: CodeXml,
};

export function Icon({ name, title, class: cls }: { name: string; title?: string; class?: string }) {
  const L = I[name] ?? Info;
  return (
    <L
      class={cls}
      size="1em"
      strokeWidth={1.75}
      fill={name === 'play' ? 'currentColor' : 'none'}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
