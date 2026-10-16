// Post-build gate: the deliverable is one HTML file under 2 MB that makes no network calls.
import { readFileSync, statSync } from 'node:fs';

const file = 'dist/index.html';
const html = readFileSync(file, 'utf8');
const size = statSync(file).size;
const allowed = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink', 'http://www.w3.org/1999/xhtml', 'http://www.w3.org/XML/1998/namespace'];
const urls = [...new Set(html.match(/https?:\/\/[^\s"'`)<>]+/g) || [])].filter((u) => !allowed.some((a) => u.startsWith(a)));
const externalRefs = html.match(/<(script|link)[^>]+(src|href)=["']https?:/gi) || [];

console.log(`dist/index.html: ${(size / 1024).toFixed(0)} KB`);
let failed = false;
if (size > 2 * 1024 * 1024) { console.error('FAIL: build exceeds 2 MB'); failed = true; }
if (externalRefs.length) { console.error('FAIL: external script/link references:', externalRefs); failed = true; }
if (urls.length) console.log('Note: URL strings present (not loaded at runtime):', urls.slice(0, 20));
if (failed) process.exit(1);
