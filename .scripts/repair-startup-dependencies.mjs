import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

export const ORIGINAL_SHA256 = '2db6c8e554fbee14672368a0d7551a8ddd841ee96c91526eb7987a0179cfc717';
export const ORIGINAL_ALIAS = '  Sha256.prototype.toString = Sha256.prototype.hex;';
export const REPAIRED_ALIAS = `  Object.defineProperty(Sha256.prototype, 'toString', {
    value: Sha256.prototype.hex,
    writable: true,
    enumerable: true,
    configurable: true
  });`;

/** repairSha256Source repairs only the qualified 0.11.1 initializer and rejects dependency drift. */
export function repairSha256Source(source) {
  const original = source.replace(REPAIRED_ALIAS, ORIGINAL_ALIAS);
  if (createHash('sha256').update(original).digest('hex') !== ORIGINAL_SHA256) {
    throw new Error(
      'Unqualified js-sha256 source: re-run the initialization and API compatibility qualification before updating this repair.'
    );
  }
  return original.replace(ORIGINAL_ALIAS, REPAIRED_ALIAS);
}

export const DAYJS_ORIGINAL_SHA256 = '0198dd0b1f760cded169c7e7ff7eaf56bc36c4c22c7c9b7c683e59437ed8700e';
export const DAYJS_ORIGINAL_ALIAS = 'm.toString=function(){return this.$d.toUTCString()}';
export const DAYJS_REPAIRED_ALIAS =
  "Object.defineProperty(m,'toString',{value:function(){return this.$d.toUTCString()},writable:true,enumerable:true,configurable:true})";

/** repairDayjsSource repairs only the qualified diagram dependency's package-owned date prototype. */
export function repairDayjsSource(source) {
  const original = source.replace(DAYJS_REPAIRED_ALIAS, DAYJS_ORIGINAL_ALIAS);
  if (createHash('sha256').update(original).digest('hex') !== DAYJS_ORIGINAL_SHA256) {
    throw new Error('Unqualified dayjs source: re-run hardened startup and date API qualification before updating this repair.');
  }
  return original.replace(DAYJS_ORIGINAL_ALIAS, DAYJS_REPAIRED_ALIAS);
}

/** repairInstalledDependencies validates every inclusion path before repairing only package-owned initializer aliases. */
export function repairInstalledDependencies(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const consumerRequire = createRequire(require.resolve('@laisky/js-utils/package.json'));
  const paths = new Set([require.resolve('js-sha256'), consumerRequire.resolve('js-sha256')]);
  const repairs = Array.from(paths, (filename) => {
    const source = readFileSync(filename, 'utf8');
    return { filename, source, repaired: repairSha256Source(source) };
  });
  const diagramRequire = createRequire(require.resolve('mermaid'));
  const filename = diagramRequire.resolve('dayjs');
  const source = readFileSync(filename, 'utf8');
  repairs.push({ filename, source, repaired: repairDayjsSource(source) });
  const changed = repairs.filter(({ source, repaired }) => source !== repaired);
  for (const { filename, repaired } of changed) {
    writeFileSync(filename, repaired);
  }
  if (changed.length) {
    // Vite's optimizer may otherwise reuse output made from the unpatched locked version.
    rmSync(path.join(root, 'node_modules', '.vite'), { recursive: true, force: true });
  }
  return changed.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  repairInstalledDependencies(root);
}
