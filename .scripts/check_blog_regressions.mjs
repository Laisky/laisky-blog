import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';

// These checked-in identities are reviewed acceptance, not generated during a CI run.
export const identities = JSON.parse(readFileSync(new URL('./blog_regression_identities.json', import.meta.url), 'utf8'));
export const expected = Object.fromEntries(Object.entries(identities).map(([file, tests]) => [file, tests.length]));

/** checkReport validates the supplied Vitest report against retained test identities, throws on any mismatch, and returns no value. */
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
    const actualIdentities = tests.map((test) => JSON.stringify([test.ancestorTitles, test.title]));
    assert.equal(new Set(actualIdentities).size, count);
    assert.deepEqual(
      actualIdentities.sort(),
      identities[file].map((identity) => JSON.stringify(identity)).sort(),
      `Retained identities changed: ${file}`
    );
    assert.ok(
      tests.every((test) => test.status === 'passed'),
      `Incomplete regression file: ${file}`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkReport(JSON.parse(readFileSync(process.argv[2], 'utf8')));
}
