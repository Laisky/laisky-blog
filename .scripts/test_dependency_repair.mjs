import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeSourceAtomically } from './repair-startup-dependencies.mjs';

/** fixture creates a disposable original dependency source and guarantees directory cleanup. */
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-dependency-repair-'));
  const filename = path.join(directory, 'source.js');
  fs.writeFileSync(filename, 'original qualified bytes', { mode: 0o640 });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, filename };
}

test('atomic replacement retains file mode and removes its temporary file', (t) => {
  const { directory, filename } = fixture(t);
  const mode = fs.statSync(filename).mode & 0o777;
  writeSourceAtomically(filename, 'complete replacement bytes');
  assert.equal(fs.readFileSync(filename, 'utf8'), 'complete replacement bytes');
  assert.equal(fs.statSync(filename).mode & 0o777, mode);
  assert.deepEqual(fs.readdirSync(directory), ['source.js']);
});

for (const stage of ['partial-write', 'rename']) {
  test(`${stage} failure preserves the original and permits a clean retry`, (t) => {
    const { directory, filename } = fixture(t);
    if (stage === 'partial-write') {
      const write = fs.writeFileSync.bind(fs);
      t.mock.method(fs, 'writeFileSync', (temporary, source, options) => {
        write(temporary, source.slice(0, 5), options);
        throw new Error('injected write failure');
      });
    } else {
      t.mock.method(fs, 'renameSync', () => {
        throw new Error('injected rename failure');
      });
    }
    assert.throws(() => writeSourceAtomically(filename, 'complete replacement bytes'), /injected/);
    assert.equal(fs.readFileSync(filename, 'utf8'), 'original qualified bytes');
    assert.deepEqual(fs.readdirSync(directory), ['source.js']);
    t.mock.restoreAll();
    writeSourceAtomically(filename, 'complete replacement bytes');
    assert.equal(fs.readFileSync(filename, 'utf8'), 'complete replacement bytes');
  });
}
