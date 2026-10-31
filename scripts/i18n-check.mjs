// Checks every tx()/tk()/tn() key against src/i18n/en.ts.
//   node scripts/i18n-check.mjs          -> errors (exit 1) + unused keys (warning)
//   node scripts/i18n-check.mjs --json   -> { errors, missing, unused }
// TypeScript 7 ships no compiler API here, so this parses with @babel/parser.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';

const FNS = new Set(['tx', 'tk', 'tn']);
const BAD_CHARS = /[\u064A\u0643\u0649]/; // Arabic yeh/kaf/alef-maqsura; Persian uses ی ک
const PERSIAN = /[\u0600-\u06FF]/;
const SKIP = /\.test\.|^src\/i18n\/en\.ts$/;

const files = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) && !SKIP.test(p) ? [p] : [];
  });

const ast = (file) => parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] });

/** Keys and values of the `en` object in src/i18n/en.ts. */
const dict = new Map();
const decls = ast('src/i18n/en.ts').program.body.flatMap((s) => (s.type === 'ExportNamedDeclaration' && s.declaration?.type === 'VariableDeclaration' ? s.declaration.declarations : s.type === 'VariableDeclaration' ? s.declarations : []));
for (const prop of decls.flatMap((d) => (d.init?.type === 'ObjectExpression' ? d.init.properties : []))) {
  if (prop.type === 'ObjectProperty' && prop.key.type === 'StringLiteral') dict.set(prop.key.value, prop.value.value);
}

const used = new Map();
const errors = [];

for (const file of files('src')) {
  const src = ast(file);
  const walk = (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && FNS.has(n.callee.name)) {
      const fn = n.callee.name;
      const a = n.arguments[0];
      const at = `${file}:${n.loc.start.line}`;
      if (a?.type === 'StringLiteral') used.set(a.value, { at, fn });
      else if (a?.type === 'TemplateLiteral' && a.expressions.length === 0) used.set(a.quasis[0].value.cooked, { at, fn });
      else if (a?.type === 'TemplateLiteral' || a?.type === 'BinaryExpression') errors.push(`${at}  ${fn}() with concatenation/template: use a {placeholder}`);
      // identifier or obj[key] is allowed: its value is a key marked with tk()
    }
    for (const k in n) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => c?.type && walk(c));
      else if (v?.type) walk(v);
    }
  };
  walk(src);
}

const phSet = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const badKey = (k) => BAD_CHARS.test(k) || k !== k.trim() || /\s{2,}/.test(k);

for (const [k, { at, fn }] of used) {
  if (badKey(k)) errors.push(`${at}  Arabic letter or stray space in key: «${k}»`);
  const v = dict.get(k);
  if (v === undefined) {
    errors.push(`${at}  untranslated: ${k}`);
    continue;
  }
  if (PERSIAN.test(v)) errors.push(`${at}  English text contains Persian letters: ${k}`);
  if (fn === 'tn' && !v.includes(' | ')) errors.push(`${at}  tn() without plural form (" | "): ${k}`);
  const kp = phSet(k);
  const vp = phSet(v);
  if (fn === 'tn') {
    kp.delete('n');
    vp.delete('n');
  }
  if (!same(kp, vp)) errors.push(`${at}  placeholder mismatch: ${k}`);
}
for (const k of dict.keys()) if (badKey(k)) errors.push(`en.ts  Arabic letter or stray space in key: «${k}»`);

const missing = [...used.keys()].filter((k) => !dict.has(k));
const unused = [...dict.keys()].filter((k) => !used.has(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ errors, missing, unused }, null, 2));
} else {
  console.log(`${used.size} keys used · ${dict.size} in en.ts · ${missing.length} missing · ${unused.length} unused · ${errors.length} errors`);
  if (unused.length) console.warn(`\nwarning: ${unused.length} unused keys (Persian copy may have been edited):\n${unused.map((x) => '  ' + x).join('\n')}`);
  if (errors.length) console.error(`\n${errors.join('\n')}`);
}
process.exit(errors.length ? 1 : 0);
