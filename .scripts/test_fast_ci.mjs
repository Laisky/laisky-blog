import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { suites, validateBase, validateDiscovery, validateReport, runCommand } from './fast_ci.mjs';

/** discovery returns the nine expected synthetic discovery entries for validation controls. */
function discovery() {
  return Object.entries(suites).flatMap(([file, names]) => names.map((name) => ({ file: resolve(file), name })));
}

/** report returns a complete successful synthetic report for validation controls. */
function report() {
  return {
    success: true,
    numTotalTests: 9,
    numPassedTests: 9,
    numFailedTests: 0,
    numPendingTests: 0,
    testResults: Object.entries(suites).map(([name, names]) => ({
      name: resolve(name),
      status: 'passed',
      assertionResults: names.map((fullName) => {
        const parts = fullName.split(' > ');
        return { ancestorTitles: parts.slice(0, -1), title: parts.at(-1), status: 'passed' };
      }),
    })),
  };
}

test('complete discovery and report pass', () => {
  validateDiscovery(discovery());
  validateReport(report(), 0);
});
test('empty or missing discovery fails', () => {
  assert.throws(() => validateDiscovery([]));
  assert.throws(() => validateDiscovery(discovery().slice(1)));
});
test('duplicate discovery fails', () => {
  const rows = discovery();
  rows[0] = rows[1];
  assert.throws(() => validateDiscovery(rows));
});
test('failed native status fails despite pass report', () => assert.throws(() => validateReport(report(), 7)));
test('empty report fails', () => assert.throws(() => validateReport({ success: true, numTotalTests: 0 }, 0)));
test('skipped failed and pending assertions fail', () => {
  for (const status of ['skipped', 'failed', 'pending', 'todo']) {
    const result = report();
    result.testResults[0].assertionResults[0].status = status;
    assert.throws(() => validateReport(result, 0));
  }
});
test('missing file completion fails', () => {
  const result = report();
  result.testResults[0].status = 'failed';
  assert.throws(() => validateReport(result, 0));
});
test('missing duplicate or renamed assertion fails', () => {
  const result = report();
  result.testResults[0].assertionResults[0].title = 'renamed';
  assert.throws(() => validateReport(result, 0));
});
test('missing malformed and zero event bases fail', () => {
  for (const base of [undefined, 'v2', '0'.repeat(40)]) assert.throws(() => validateBase(base));
});
test('native failure retains exit code', () => {
  const records = [];
  const dir = mkdtempSync(join(tmpdir(), 'blog-gate-failure-'));
  assert.throws(() => runCommand(process.execPath, ['-e', 'process.exit(7)'], dir, 'failure', records));
  assert.equal(records[0].exit_code, 7);
});
test('timeout retains unknown exit status', () => {
  const records = [];
  const dir = mkdtempSync(join(tmpdir(), 'blog-gate-timeout-'));
  assert.throws(() => runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], dir, 'timeout', records, 10));
  assert.equal(records[0].exit_code, null);
});
