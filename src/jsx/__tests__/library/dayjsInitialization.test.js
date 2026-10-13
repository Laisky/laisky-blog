// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const mermaidRequire = createRequire(require.resolve('mermaid'));
const filename = mermaidRequire.resolve('dayjs');

/** initializeDate loads the actual diagram dependency after establishing an isolated realm's toString protection. */
function initializeDate(hardened) {
  const realm = vm.createContext({});
  if (hardened) vm.runInContext("Object.defineProperty(Object.prototype, 'toString', { writable: false, configurable: false });", realm);
  const descriptor = vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString')", realm);
  vm.runInContext(readFileSync(filename, 'utf8'), realm);
  expect(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString')", realm)).toEqual(descriptor);
  return realm;
}

describe('diagram date dependency initialization', () => {
  it.each([false, true])('retains date operations with inherited protection=%s', (hardened) => {
    const realm = initializeDate(hardened);
    expect(vm.runInContext("dayjs('2026-10-13T00:00:00Z').toString()", realm)).toBe('Tue, 13 Oct 2026 00:00:00 GMT');
    expect(vm.runInContext("dayjs('2026-10-13T00:00:00Z').toISOString()", realm)).toBe('2026-10-13T00:00:00.000Z');
    expect(vm.runInContext("dayjs('2026-10-13T00:00:00Z').add(1, 'day').diff(dayjs('2026-10-13T00:00:00Z'), 'day')", realm)).toBe(1);
    expect(vm.runInContext("dayjs('not a date').isValid()", realm)).toBe(false);
    vm.runInContext(readFileSync(mermaidRequire.resolve('dayjs/plugin/utc'), 'utf8'), realm);
    vm.runInContext('dayjs.extend(dayjs_plugin_utc)', realm);
    expect(vm.runInContext("dayjs.utc('2026-10-13T00:00:00Z').format()", realm)).toBe('2026-10-13T00:00:00Z');
    expect(vm.runInContext("dayjs.utc('2026-10-13T00:00:00Z').toString()", realm)).toBe('Tue, 13 Oct 2026 00:00:00 GMT');
  });
});
