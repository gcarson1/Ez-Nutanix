// The modules, read from each module's content.ts (no app code is imported), shared by the smoke specs.
// It throws, rather than quietly returning empty strings, when a file does not have the shape it expects.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve('src/ui/modules');
const FILES = readdirSync(DIR).filter((d) => existsSync(join(DIR, d, 'content.ts')));

/** The value of a top-level `  key: 'text'` line in a content.ts (single or double quotes, escapes allowed). */
function field(src: string, key: string, file: string): string {
  const m = src.match(new RegExp(`^  ${key}:\\s*(['"])((?:[^'"\\\\]|\\\\.|(?!\\1)['"])*)\\1`, 'm'));
  if (!m || !m[2]) throw new Error(`${file}: no top-level "${key}" found; the module list the smoke tests build is wrong`);
  return m[2].replace(/\\(.)/g, '$1');
}

export const MODULES = FILES.map((d) => {
  const file = join(DIR, d, 'content.ts');
  const src = readFileSync(file, 'utf8');
  return { content: { path: field(src, 'path', file), title: field(src, 'title', file) } };
});

if (MODULES.length < 20) throw new Error(`Only ${MODULES.length} modules found in ${DIR}`);
const paths = MODULES.map((m) => m.content.path);
if (new Set(paths).size !== paths.length) throw new Error('Two modules share a path');

export const PATHS = paths;
