// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_ALIAS, REPAIRED_ALIAS, repairSha256Source } from '../../../../.scripts/repair-startup-dependencies.mjs';

const require = createRequire(import.meta.url);
const installed = readFileSync(require.resolve('js-sha256'), 'utf8');
const original = installed.replace(REPAIRED_ALIAS, ORIGINAL_ALIAS);

/** loadSource evaluates a source variant under the same isolated, immutable inherited property. */
function loadSource(source) {
  const realm = vm.createContext({});
  vm.runInContext(
    "globalThis.window = globalThis; Object.defineProperty(Object.prototype, 'toString', { writable: false, configurable: false });",
    realm
  );
  vm.runInContext(source, realm);
  return realm;
}

describe('qualified dependency repair', () => {
  it('retains the failing original as a negative control', () => {
    expect(() => loadSource(original)).toThrow(/read only property 'toString'/);
    expect(loadSource(repairSha256Source(original)).sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is idempotent and preserves the ordinary assignment descriptors', () => {
    const repaired = repairSha256Source(original);
    expect(repairSha256Source(repaired)).toBe(repaired);
    const realm = loadSource(repaired);
    const descriptor = vm.runInContext("Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sha256.create()), 'toString')", realm);
    expect(descriptor).toMatchObject({ writable: true, enumerable: true, configurable: true });
    expect(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString').writable", realm)).toBe(false);
  });

  it('rejects drift and any attempted global-prototype workaround', () => {
    expect(() => repairSha256Source(original + '\n// changed dependency')).toThrow('Unqualified js-sha256 source');
    expect(() => repairSha256Source(original.replace('Sha256.prototype.toString', 'Object.prototype.toString'))).toThrow('Unqualified');
    expect(() => loadSource("Object.defineProperty(Object.prototype, 'toString', { writable: true });")).toThrow();
  });
});

describe('diagram dependency repair controls', () => {
  it('is idempotent and rejects unqualified source or prototype workarounds', async () => {
    const { repairDayjsSource, DAYJS_ORIGINAL_ALIAS, DAYJS_REPAIRED_ALIAS } = await import(
      '../../../../.scripts/repair-startup-dependencies.mjs'
    );
    const source = readFileSync(createRequire(require.resolve('mermaid')).resolve('dayjs'), 'utf8');
    const original = source.replace(DAYJS_REPAIRED_ALIAS, DAYJS_ORIGINAL_ALIAS);
    expect(repairDayjsSource(original)).toBe(repairDayjsSource(repairDayjsSource(original)));
    expect(() => repairDayjsSource(original + 'globalThis.canary = true;')).toThrow('Unqualified');
  });
});
