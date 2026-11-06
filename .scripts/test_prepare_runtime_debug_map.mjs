import { Buffer } from 'node:buffer';
import process from 'node:process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { SourceMapConsumer } from 'source-map-js';
import { minify } from 'rolldown/experimental';
import { createRuntimeDebugMap } from './prepare_runtime_debug_map.mjs';

const generated = 'export function sample() {\n  throw new Error("synthetic");\n}\n';

/** minified generates a private synthetic input and an expected output from the installed minifier. */
const minified = async () => (await minify('generated-runtime.js', generated, { sourcemap: true })).code;

test('maps the exact generated script back to its unminified generated source', async () => {
  const code = await minified();
  const map = await createRuntimeDebugMap(Buffer.from(code), generated);
  const column = code.indexOf('throw');
  const original = new SourceMapConsumer(map).originalPositionFor({ line: 1, column });
  assert.equal(original.source, 'generated-runtime.js');
  assert.equal(original.line, 2);
  assert.equal(map.sourcesContent[0], generated);
});

test('rejects changed deployed bytes, changed generated source and other Rolldown versions', async () => {
  const code = await minified();
  await assert.rejects(createRuntimeDebugMap(Buffer.from(code + ' '), generated), /bytes do not match/);
  await assert.rejects(createRuntimeDebugMap(Buffer.from(code), generated.replace('synthetic', 'changed')), /bytes do not match/);
  await assert.rejects(createRuntimeDebugMap(Buffer.from(code), generated, '0.0.0'), /Unqualified/);
});

test('writes private output only once and rejects repository output', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'blog-runtime-map-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const deploy = join(root, 'deploy');
  const privateDir = join(root, 'private');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(deploy, 'assets'), { recursive: true });
  await mkdir(privateDir);
  const asset = join(deploy, 'assets', 'rolldown-runtime-abc.js');
  const input = join(root, 'generated.js');
  const output = join(privateDir, 'runtime.js.map');
  await writeFile(asset, await minified());
  await writeFile(input, generated);
  const run = promisify(execFile);
  const script = '.scripts/prepare_runtime_debug_map.mjs';
  await run(process.execPath, [script, asset, input, output]);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).file, 'rolldown-runtime-abc.js');
  await assert.rejects(run(process.execPath, [script, asset, input, output]));
  await assert.rejects(run(process.execPath, [script, asset, input, 'runtime.js.map']));
});
