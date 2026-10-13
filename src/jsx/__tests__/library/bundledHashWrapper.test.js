// @vitest-environment node
import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import vm from 'node:vm';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

let bundled;
/** bundleWrapper builds the real utility import and direct hash API with only unrelated unused packages externalized. */
async function bundleWrapper() {
  const entry = '\0hash-wrapper-acceptance';
  const output = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'hash-wrapper-acceptance',
        resolveId: (id) => (id.endsWith('hash-wrapper-acceptance') ? entry : undefined),
        load: (id) =>
          id === entry
            ? "import jsutils from '@laisky/js-utils'; import { sha256 } from 'js-sha256'; export const hash = jsutils.SHA256; export const direct = sha256;"
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: true,
      lib: { entry, name: 'HashAcceptance', formats: ['iife'] },
      rollupOptions: {
        external: ['marked', 'bootstrap', 'pouchdb'],
        output: { globals: { marked: 'UnusedMarked', bootstrap: 'UnusedBootstrap', pouchdb: 'UnusedPouchDB' } },
      },
    },
  });
  return output[0].output.find((file) => file.type === 'chunk').code;
}
beforeAll(async () => {
  bundled = await bundleWrapper();
});

describe('actual bundled utility SHA256 contract', () => {
  for (const hardened of [false, true]) {
    for (const native of [false, true]) {
      it(`preserves asynchronous strings and cache keys with hardened=${hardened}, WebCrypto=${native}`, async () => {
        const realm = vm.createContext({
          crypto: native ? webcrypto : {},
          TextEncoder,
          UnusedMarked: {},
          UnusedBootstrap: {},
          UnusedPouchDB: {},
        });
        vm.runInContext('globalThis.window = globalThis;', realm);
        if (hardened)
          vm.runInContext("Object.defineProperty(Object.prototype, 'toString', { writable: false, configurable: false });", realm);
        vm.runInContext(bundled, realm);
        for (const input of ['', 'abc', '中文 🪿 café', 'loadPage:en_US:0', 'loadPostInfo', 'post:zh_CN:example', 'postSeries:golang']) {
          realm.input = input;
          const result = vm.runInContext('HashAcceptance.hash(input)', realm);
          expect(typeof result.then).toBe('function');
          const expected = createHash('sha256').update(input).digest('hex');
          expect(await result).toBe(expected);
          expect(vm.runInContext('HashAcceptance.direct(input)', realm)).toBe(expected);
        }
        expect(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString').writable", realm)).toBe(!hardened);
      });
    }
  }
});
