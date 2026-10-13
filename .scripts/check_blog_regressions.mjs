import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const expected = {
  'library/sha256Initialization.test.js': 28,
  'library/sha256Repair.test.js': 4,
  'library/dayjsInitialization.test.js': 2,
  'library/bundledHashWrapper.test.js': 4,
  'library/asyncWork.test.js': 16,
  'library/optionalScriptLifecycle.test.js': 7,
  'pages/pageRequests.test.jsx': 19,
  'pages/failureRecovery.test.jsx': 9,
};

/** checkReport requires full native success and completion of every retained handoff regression without skips or duplicates. */
export function checkReport(report) {
  assert.equal(report.success, true);
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numPassedTests, report.numTotalTests);
  assert.ok(report.numTotalTests >= Object.values(expected).reduce((total, count) => total + count, 0));
  for (const [file, count] of Object.entries(expected)) {
    const matches = report.testResults.filter((result) => result.name.replaceAll('\\', '/').endsWith(`/src/jsx/__tests__/${file}`));
    assert.equal(matches.length, 1, `Missing or duplicate regression file: ${file}`);
    assert.equal(matches[0].status, 'passed');
    const tests = matches[0].assertionResults;
    assert.equal(tests.length, count, `Unexpected regression count: ${file}`);
    assert.equal(new Set(tests.map((test) => JSON.stringify([test.ancestorTitles, test.title]))).size, count);
    assert.ok(
      tests.every((test) => test.status === 'passed'),
      `Incomplete regression file: ${file}`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkReport(JSON.parse(readFileSync(process.argv[2], 'utf8')));
}
