import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file: JS, CSS and fonts are inlined so it works offline and as an attachment.
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000, cssCodeSplit: false, reportCompressedSize: false },
});
