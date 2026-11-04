import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { consumeSSOCallbackToken, SSOCallbackParameters } from '../../library/sso';

vi.mock('@laisky/js-utils', () => ({ default: { KvSet: vi.fn(), KvGet: vi.fn(), KvDel: vi.fn() } }));

// Building blocks for every fragment of up to MaxPieces pieces: an ordinary name, a plain and an
// encoded case-alias marker name, a value, and the three delimiters the fragment readings split on.
const Pieces = ['n', 'sso_token', 'SSO%5Fcode', '=v', '?', '#', '&'];
const MaxPieces = 5;
const OracleBase = 'https://example.invalid/';

/**
 * isMarker recognizes a reserved protocol name independently of the module under test.
 *
 * @param {string} name - A decoded parameter name.
 * @returns {boolean} True for a reserved name in any letter case.
 */
const isMarker = (name) => SSOCallbackParameters.includes(name.toLowerCase());

/**
 * fragmentsUpTo enumerates every piece sequence up to the given length and numbers each value.
 *
 * Unique values such as v3v let a check find which value bytes survived cleanup.
 *
 * @param {number} maxPieces - The longest sequence to build.
 * @returns {string[]} The fragments without their leading "#".
 */
const fragmentsUpTo = (maxPieces) => {
  const fragments = [];
  let layer = [[]];
  for (let length = 1; length <= maxPieces; length += 1) {
    layer = layer.flatMap((prefix) => Pieces.map((piece) => [...prefix, piece]));
    for (const sequence of layer) {
      fragments.push(sequence.map((piece, index) => (piece === '=v' ? `=v${index}v` : piece)).join(''));
    }
  }
  return fragments;
};

/**
 * oracleEntries reads a fragment as standard readers do, without using the module under test.
 *
 * Each "#" segment is read as form data and, through the WHATWG URL parser, as a relative
 * reference whose query a hash router would read. The shared Blog SSO reading also passes that
 * query to the URLSearchParams constructor, which drops one more leading "?", so "#??sso_token"
 * counts as a marker on both the issuer and the consumer. That conservative reading is
 * included here, so the oracle matches the protocol rather than a narrower one.
 *
 * @param {string} fragment - A fragment without its leading "#".
 * @returns {Array<[string, string]>} Every name-value pair under both readings.
 */
const oracleEntries = (fragment) =>
  fragment.split('#').flatMap((segment) => {
    const reference = new URL(segment, OracleBase);
    return [...new URLSearchParams(segment), ...reference.searchParams, ...new URLSearchParams(reference.search.slice(1))];
  });

/**
 * legacyCleanup applies the form-data-only cleanup that shipped before hash-route readings.
 *
 * @param {string} fragment - A fragment without its leading "#".
 * @returns {string} The fragment that rule produces.
 */
const legacyCleanup = (fragment) => {
  const form = new URLSearchParams(fragment);
  const markers = [...form.keys()].filter(isMarker);
  if (markers.length === 0) return fragment;
  markers.forEach((name) => form.delete(name));
  return form.toString();
};

/**
 * isSubsequence reports whether every kept entry appears in the original entries, in order.
 *
 * @param {Array<[string, string]>} kept - The entries after cleanup.
 * @param {Array<[string, string]>} original - The entries before cleanup.
 * @returns {boolean} True when cleanup only removed entries.
 */
const isSubsequence = (kept, original) => {
  let index = 0;
  for (const [name, value] of original) {
    if (index < kept.length && kept[index][0] === name && kept[index][1] === value) index += 1;
  }
  return index === kept.length;
};

/**
 * cleanupViolations runs a rejected callback carrying the fragment and lists every broken rule.
 *
 * @param {string} fragment - A fragment without its leading "#".
 * @returns {Promise<string[]>} The violated rules; empty when cleanup behaved.
 */
const cleanupViolations = async (fragment) => {
  window.history.replaceState({}, '', `/p/a/?sso_flow=code#${fragment}`);
  const outcome = await consumeSSOCallbackToken().then(
    () => 'resolved',
    (error) => error.message
  );
  const cleaned = window.location.hash.slice(1);
  const before = oracleEntries(fragment);
  const violations = [];
  if (!outcome.startsWith('Sign-in could not')) violations.push(`outcome ${outcome}`);
  if (oracleEntries(cleaned).some(([name]) => isMarker(name))) violations.push(`marker kept in #${cleaned}`);
  const leaked = before
    .filter(([name]) => isMarker(name))
    .flatMap(([, value]) => value.match(/v\d+v/g) ?? [])
    .filter((token) => window.location.href.includes(token));
  if (leaked.length > 0) violations.push(`marker value ${leaked[0]} kept in #${cleaned}`);
  if (!before.some(([name]) => isMarker(name)) && cleaned !== fragment) violations.push(`ordinary fragment became #${cleaned}`);
  if (!/[?#]/.test(fragment.replace(/^\?/, '')) && cleaned !== legacyCleanup(fragment)) {
    violations.push(`form-only fragment became #${cleaned}, not #${legacyCleanup(fragment)}`);
  }
  if (cleaned !== fragment && !isSubsequence([...new URLSearchParams(cleaned)], [...new URLSearchParams(fragment)])) {
    violations.push(`entries rewritten as #${cleaned}`);
  }
  return violations.map((violation) => `#${fragment}: ${violation}`);
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    })
  );
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

test('removes every fragment marker and marker value, and nothing else, for every short fragment', async () => {
  const fragments = fragmentsUpTo(MaxPieces);
  const violations = [];
  for (const fragment of fragments) violations.push(...(await cleanupViolations(fragment)));
  expect(violations.length, violations.slice(0, 10).join('\n')).toBe(0);

  // Positive controls: the enumeration reaches ordinary fragments, form-only markers, and markers
  // that only a hash-route query or nested segment shows.
  const shown = (fragment) => oracleEntries(fragment).some(([name]) => isMarker(name));
  const formShown = (fragment) => [...new URLSearchParams(fragment).keys()].some(isMarker);
  expect(fragments.length).toBe(19607);
  expect(fragments.filter((fragment) => !shown(fragment)).length).toBeGreaterThan(1000);
  expect(fragments.filter((fragment) => formShown(fragment) && !/[?#]/.test(fragment)).length).toBeGreaterThan(100);
  expect(fragments.filter((fragment) => shown(fragment) && !formShown(fragment)).length).toBeGreaterThan(1000);
  expect(fragments).toContain('sso_token&?sso_token=v4v');
  expect(fragments).toContain('sso_token&#sso_token=v4v');
}, 60000);
