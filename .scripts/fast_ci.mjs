/** Fast CI records native failures and requires exact discovery and test completion. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const suites = {
  'src/jsx/__tests__/library/postMeta.test.jsx': [
    'postMeta helpers > toDatetimeLocalValue converts ISO value to datetime-local',
    'postMeta helpers > datetimeLocalValueToISO returns undefined for invalid value',
    'postMeta helpers > buildLocationPayload normalizes city and coordinates',
    'postMeta helpers > buildMutationPostCandidates returns rich-first deduplicated payloads',
  ],
  'src/jsx/__tests__/pages/pagesFold.test.js': [
    'pagesFold.calculateRibbonFold > mobile + down: does not fold just because top is under navbar',
    'pagesFold.calculateRibbonFold > mobile + down: fully folds when post centre is well above safe zone',
    'pagesFold.calculateRibbonFold > desktop behavior: post centre in safe zone stays fully visible',
    'pagesFold.calculateRibbonFold > bottom entry fold: fully folds when post centre is well below safe zone',
    'pagesFold.calculateRibbonFold > partial fold: post centre just outside safe zone',
  ],
};

/** validateBase checks a nonzero full commit SHA and returns it or throws. */
export function validateBase(base) {
  if (!/^[a-f0-9]{40}$/.test(base ?? '') || /^0+$/.test(base)) throw new Error('A verified nonzero full event-base SHA is required');
  return base;
}

/** assertNames requires the exact unique test names for one file and returns no value. */
function assertNames(actual, expected) {
  if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some((name) => !expected.includes(name))) {
    throw new Error('Missing, duplicate, or unexpected essential tests');
  }
}

/** localPath converts an absolute report path into a repository-relative POSIX path. */
function localPath(file) {
  return relative(process.cwd(), file).replaceAll('\\', '/');
}

/** validateDiscovery requires every selected test to be discovered exactly once and returns no value. */
export function validateDiscovery(discovered) {
  if (!Array.isArray(discovered) || discovered.length !== 9) throw new Error('Expected discovery of nine essential tests');
  for (const [file, names] of Object.entries(suites)) {
    assertNames(
      discovered.filter((test) => localPath(test.file) === file).map((test) => test.name),
      names
    );
  }
}

/** validateReport requires native success, exact test accounting and successful file completion. */
export function validateReport(report, status) {
  if (
    status !== 0 ||
    report.success !== true ||
    report.numTotalTests !== 9 ||
    report.numPassedTests !== 9 ||
    report.numFailedTests !== 0 ||
    report.numPendingTests !== 0 ||
    report.testResults?.length !== 2
  ) {
    throw new Error('Essential test run did not complete successfully');
  }
  for (const [file, names] of Object.entries(suites)) {
    const matches = report.testResults.filter((result) => localPath(result.name) === file);
    if (matches.length !== 1 || matches[0].status !== 'passed') throw new Error('Missing successful file completion');
    const assertions = matches[0].assertionResults;
    if (!Array.isArray(assertions) || assertions.some((test) => test.status !== 'passed'))
      throw new Error('Failed, skipped or pending test');
    assertNames(
      assertions.map((test) => [...test.ancestorTitles, test.title].join(' > ')),
      names
    );
  }
}

/** runCommand runs a native command, records output/status/time and throws on errors or timeouts. */
export function runCommand(command, args, evidence, label, records, timeout = 240000) {
  const start = performance.now();
  const result = spawnSync(command, args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
  const record = {
    label,
    command: [command, ...args],
    exit_code: result.status,
    signal: result.signal,
    seconds: (performance.now() - start) / 1000,
    error: result.error?.message,
  };
  records.push(record);
  writeFileSync(resolve(evidence, `${label}.stdout`), result.stdout ?? '');
  writeFileSync(resolve(evidence, `${label}.stderr`), result.stderr ?? '');
  if (result.error || result.status !== 0) throw new Error(`${label} failed: ${result.error?.message ?? `native exit ${result.status}`}`);
  return result.stdout;
}

/** main runs frozen setup, changed-file formatting and nine discovered units, returning a native exit code. */
export function main() {
  const evidence = resolve(process.env.FAST_CI_EVIDENCE ?? '.cache/fast-ci');
  mkdirSync(evidence, { recursive: true });
  const start = performance.now();
  const receipt = { passed: false, commands: [] };
  const run = (command, args, label) => runCommand(command, args, evidence, label, receipt.commands);
  const yarn = (args, label) =>
    process.env.YARN_CLI ? run(process.execPath, [process.env.YARN_CLI, ...args], label) : run('yarn', args, label);
  try {
    receipt.source = run('git', ['rev-parse', 'HEAD'], 'source').trim();
    receipt.node = run(process.execPath, ['--version'], 'node').trim();
    receipt.yarn = yarn(['--version'], 'yarn').trim();
    receipt.base = validateBase(process.env.FAST_CI_BASE);
    run('git', ['cat-file', '-e', `${receipt.base}^{commit}`], 'verify-base');
    yarn(['install', '--frozen-lockfile', '--non-interactive'], 'frozen-install');
    const formatProbe = relative(process.cwd(), resolve(evidence, 'format-negative.mjs')).replaceAll('\\', '/');
    writeFileSync(resolve(evidence, 'format-negative.mjs'), 'const probe={value:1}\n');
    let formatRejected = false;
    try {
      yarn(['prettier', '--check', `./${formatProbe}`], 'format-negative');
    } catch (error) {
      if (receipt.commands.at(-1).exit_code !== 1) throw error;
      receipt.commands.at(-1).expected_exit_code = 1;
      formatRejected = true;
    }
    if (!formatRejected) throw new Error('Formatter did not reject the deliberately unformatted control');
    const changed = run('git', ['diff', '--name-only', '-z', '--diff-filter=ACMRT', receipt.base, '--'], 'changed-files')
      .split('\0')
      .filter(Boolean);
    const own = ['.scripts/fast_ci.mjs', '.scripts/test_fast_ci.mjs', '.github/workflows/fast-ci.yml', 'docs/fast-ci.md'];
    receipt.format_files = [...new Set([...changed, ...own])].filter((file) =>
      /\.(?:[cm]?js|jsx|ts|tsx|json|html|css|scss|md|ya?ml)$/.test(file)
    );
    // Prefix every Git path so a filename cannot become a formatter option.
    yarn(['prettier', '--check', ...receipt.format_files.map((file) => `./${file}`)], 'changed-format');
    const files = Object.keys(suites);
    const discovery = resolve(evidence, 'discovery.json');
    writeFileSync(discovery, '');
    yarn(['vitest', 'list', ...files, `--json=${discovery}`, '--maxWorkers=2'], 'discover');
    validateDiscovery(JSON.parse(readFileSync(discovery, 'utf8')));
    const report = resolve(evidence, 'tests.json');
    writeFileSync(report, '');
    yarn(
      [
        'test',
        '--run',
        ...files,
        '--reporter=json',
        `--outputFile=${report}`,
        '--maxWorkers=2',
        '--allowOnly=false',
        '--passWithNoTests=false',
      ],
      'tests'
    );
    validateReport(JSON.parse(readFileSync(report, 'utf8')), receipt.commands.at(-1).exit_code);
    run('git', ['diff', '--exit-code', '--', 'package.json', 'yarn.lock', 'package-lock.json'], 'manifest-immutability');
    receipt.passed = true;
  } catch (error) {
    receipt.error = error.message;
    console.error(error.message);
  } finally {
    receipt.seconds = (performance.now() - start) / 1000;
    writeFileSync(resolve(evidence, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify({ passed: receipt.passed, seconds: receipt.seconds, error: receipt.error }));
  }
  return receipt.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main();
