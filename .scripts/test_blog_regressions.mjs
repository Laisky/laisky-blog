import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReport, expected } from './check_blog_regressions.mjs';

/** report creates a complete synthetic receipt for the accounting validator's positive and negative controls. */
function report() {
  return {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numPassedTests: Object.values(expected).reduce((total, count) => total + count, 0),
    numTotalTests: Object.values(expected).reduce((total, count) => total + count, 0),
    testResults: Object.entries(expected).map(([file, count]) => ({
      name: `/repo/src/jsx/__tests__/${file}`,
      status: 'passed',
      assertionResults: Array.from({ length: count }, (_, index) => ({
        ancestorTitles: ['Fixture'],
        title: String(index),
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
