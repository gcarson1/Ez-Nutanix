// Stroke icons (24-unit grid, 1.75 stroke). Sized by CSS in rem.
const P: Record<string, string> = {
  back: 'M15 18l-6-6 6-6',
  chev: 'M9 6l6 6-6 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  play: 'M7 5v14l11-7z',
  pause: 'M8 5v14M16 5v14',
  step: 'M6 5v14l9-7zM18 5v14',
  stepback: 'M18 5v14l-9-7zM6 5v14',
  reset: 'M4 4v6h6M4.6 15a8 8 0 1 0 1.9-8.3L4 10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  book: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10',
  podium: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M8 21h8',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  ok: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.7 2.7L16 9.8',
  x: 'M6 6l12 12M18 6 6 18',
  bad: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6',
  warn: 'M12 4 2.8 20h18.4zM12 10v4M12 17h.01',
  rebuild: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  flow: 'M4 12h12M12 6l6 6-6 6M4 6v12',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  cloud: 'M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18z',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  net: 'M12 3v6M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 21v-4h14v4M12 13v4',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5 12 22.5l10-5',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  popout: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0',
  disk: 'M4 5h16v14H4zM8 15h.01M12 9a2 2 0 1 0 0 .01',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  upgrade: 'M12 19V5M6 11l6-6 6 6M5 21h14',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  clone: 'M8 8h12v12H8zM4 16V4h12',
  camera: 'M4 7h4l2-2h4l2 2h4v12H4zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ai: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
  k8s: 'M12 2.5l8.2 4v9L12 21.5 3.8 15.5v-9zM12 7v10M7.5 9.5l9 5M16.5 9.5l-9 5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  beacon: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  edge: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  gauge: 'M12 14l4-4M4.5 18a9 9 0 1 1 15 0',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  bucket: 'M4 6h16l-2 14H6zM4 6c0-1.7 3.6-3 8-3s8 1.3 8 3',
  money: 'M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v.01M18 15v.01',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a6 6 0 0 0-4-5.7',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  api: 'M8 6 3 12l5 6M16 6l5 6-5 6M14 4l-4 16',
  ellipsis: 'M5 12h.01M12 12h.01M19 12h.01',
};

export type IconName = keyof typeof P;

export function Icon({ name, title, class: cls }: { name: string; title?: string; class?: string }) {
  const d = P[name] ?? P.info;
  return (
    <svg
      class={cls}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width={1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <path d={d} />
    </svg>
  );
}
