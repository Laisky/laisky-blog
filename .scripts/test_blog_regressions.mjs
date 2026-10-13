import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReport, expected, identities } from './check_blog_regressions.mjs';

/** report takes no parameters and returns a complete synthetic Vitest receipt for positive and negative accounting controls. */
function report() {
  return {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numPassedTests: Object.values(expected).reduce((total, count) => total + count, 0),
    numTotalTests: Object.values(expected).reduce((total, count) => total + count, 0),
    testResults: Object.entries(identities).map(([file, tests]) => ({
      name: `/repo/src/jsx/__tests__/${file}`,
      status: 'passed',
      assertionResults: tests.map(([ancestorTitles, title]) => ({
        ancestorTitles: [...ancestorTitles],
        title,
        status: 'passed',
      })),
    })),
  };
}
test('complete regression accounting succeeds', () => checkReport(report()));
for (const [name, mutate] of [
  [
    'native failure',
    (value) => {
      value.success = false;
    },
  ],
  [
    'missing file',
    (value) => {
      value.testResults.pop();
    },
  ],
  [
    'duplicate file',
    (value) => {
      value.testResults.push(value.testResults[0]);
    },
  ],
  [
    'missing test',
    (value) => {
      value.testResults[0].assertionResults.pop();
    },
  ],
  [
    'replaced retained identity',
    (value) => {
      value.testResults[0].assertionResults[0].title = 'Unrelated passing replacement';
    },
  ],
  [
    'duplicate name',
    (value) => {
      value.testResults[0].assertionResults[1] = value.testResults[0].assertionResults[0];
    },
  ],
  [
    'skipped test',
    (value) => {
      value.testResults[0].assertionResults[0].status = 'pending';
    },
  ],
  [
    'failed test',
    (value) => {
      value.testResults[0].assertionResults[0].status = 'failed';
    },
  ],
]) {
  test(`${name} fails closed`, () => {
    const value = report();
    mutate(value);
    assert.throws(() => checkReport(value));
  });
}
