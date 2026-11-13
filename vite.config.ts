import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything is inline in the built file, so it may not load from or send to the network. Build only:
// the dev server needs its external module script and its HMR socket.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build' as const,
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' as const }],
});

// One self-contained HTML file: JS, CSS and fonts are inlined so it works offline and as an attachment.
export default defineConfig({
  plugins: [preact(), contentSecurityPolicy(), viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false },
});
