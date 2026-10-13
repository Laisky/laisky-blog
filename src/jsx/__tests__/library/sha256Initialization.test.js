// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const directPath = require.resolve('js-sha256');
const transitivePath = createRequire(require.resolve('@laisky/js-utils/package.json')).resolve('js-sha256');

/** initializeHash loads the actual dependency after establishing a disposable realm's protection. */
function initializeHash(filename, hardened) {
  const realm = vm.createContext({});
  vm.runInContext('globalThis.window = globalThis;', realm);
  if (hardened) {
    vm.runInContext("Object.defineProperty(Object.prototype, 'toString', { writable: false, configurable: false });", realm);
  }
  const descriptor = vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString')", realm);
  vm.runInContext(readFileSync(filename, 'utf8'), realm, { filename: 'js-sha256.js' });
  expect(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString')", realm)).toEqual(descriptor);
  return realm;
}

for (const [inclusion, filename] of [
  ['direct', directPath],
  ['js-utils transitive', transitivePath],
]) {
  describe(`${inclusion} hash initialization`, () => {
    for (const hardened of [false, true]) {
      describe(hardened ? 'inherited read-only toString' : 'ordinary control', () => {
        it.each(['', 'abc', '中文 🪿 café', 'loadPage:en_US:0', 'post:zh_CN:example', 'postSeries:golang'])(
          'preserves SHA-256/SHA-224 and streaming output for %j',
          (text) => {
            const realm = initializeHash(filename, hardened);
            realm.input = text;
            for (const algorithm of ['sha256', 'sha224']) {
              const expected = createHash(algorithm).update(text).digest('hex');
              for (const expression of [
                `${algorithm}(input)`,
                `${algorithm}.hex(input)`,
                `${algorithm}.create().update(input).hex()`,
                `${algorithm}.create().update(input).toString()`,
              ]) {
                expect(vm.runInContext(expression, realm)).toBe(expected);
              }
              expect(Array.from(vm.runInContext(`${algorithm}.array(input)`, realm))).toEqual(
                Array.from(createHash(algorithm).update(text).digest())
              );
              expect(Array.from(vm.runInContext(`${algorithm}.digest(input)`, realm))).toEqual(
                Array.from(createHash(algorithm).update(text).digest())
              );
              expect(Array.from(vm.runInContext(`new Uint8Array(${algorithm}.arrayBuffer(input))`, realm))).toEqual(
                Array.from(createHash(algorithm).update(text).digest())
              );
              const hmac = createHmac(algorithm, 'key').update(text).digest('hex');
              expect(vm.runInContext(`${algorithm}.hmac('key', input)`, realm)).toBe(hmac);
              expect(vm.runInContext(`${algorithm}.hmac.create('key').update(input).toString()`, realm)).toBe(hmac);
            }
          }
        );

        it('retains binary inputs, long messages, streaming chunks and invalid-input rejection', () => {
          const realm = initializeHash(filename, hardened);
          const bytes = [0, 127, 128, 255];
          const expected = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
          for (const expression of ['[0,127,128,255]', 'new Uint8Array([0,127,128,255])', 'new Uint8Array([0,127,128,255]).buffer']) {
            expect(vm.runInContext(`sha256(${expression})`, realm)).toBe(expected);
          }
          expect(vm.runInContext("sha256.create().update('a'.repeat(100)).update('b'.repeat(100)).toString()", realm)).toBe(
            createHash('sha256')
              .update('a'.repeat(100) + 'b'.repeat(100))
              .digest('hex')
          );
          expect(() => vm.runInContext('sha256(null)', realm)).toThrow('input is invalid type');
        });
      });
    }
  });
}
