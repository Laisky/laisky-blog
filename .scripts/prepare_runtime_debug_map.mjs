import { Buffer } from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
import { minify } from 'rolldown/experimental';
import { VERSION } from 'rolldown';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, basename, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QualifiedRolldown = '1.2.16';
const MaxBytes = 4 * 1024 * 1024;

/**
 * createRuntimeDebugMap maps identical minified bytes to the supplied generated runtime, not to original source.
 *
 * @param {Buffer} deployed - Exact deployment runtime bytes.
 * @param {string} generated - Unminified generated runtime from the same build inputs.
 * @param {string} version - Installed Rolldown version, provided for qualification.
 * @returns {Promise<object>} The minifier's generated-source map after byte equality is verified.
 */
export const createRuntimeDebugMap = async (deployed, generated, version = VERSION) => {
  if (version !== QualifiedRolldown) throw new Error('Unqualified Rolldown version');
  if (
    !Buffer.isBuffer(deployed) ||
    !deployed.length ||
    deployed.length > MaxBytes ||
    typeof generated !== 'string' ||
    !generated.length ||
    Buffer.byteLength(generated) > MaxBytes
  ) {
    throw new Error('Invalid runtime input');
  }
  const result = await minify('generated-runtime.js', generated, { sourcemap: true });
  if (!Buffer.from(result.code).equals(deployed)) throw new Error('Generated runtime bytes do not match deployment');
  if (
    result.map?.version !== 3 ||
    result.map.sources?.length !== 1 ||
    result.map.sources[0] !== 'generated-runtime.js' ||
    !result.map.mappings
  ) {
    throw new Error('Minifier did not produce the expected generated-source map');
  }
  return result.map;
};

/**
 * within reports whether a resolved path is equal to or nested inside a resolved directory.
 *
 * @param {string} child - Resolved candidate path.
 * @param {string} parent - Resolved directory path.
 * @returns {boolean} True when the candidate lies inside the directory.
 */
const within = (child, parent) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + '/') && rel !== '..' && !isAbsolute(rel));
};

/**
 * main writes one private map only after checking path isolation, build version and exact script bytes.
 *
 * @returns {Promise<void>} Resolves after writing a new mode-0600 map or rejects without overwriting one.
 */
const main = async () => {
  if (process.argv.length !== 5)
    throw new Error('Usage: node .scripts/prepare_runtime_debug_map.mjs DEPLOYED_RUNTIME GENERATED_RUNTIME PRIVATE_MAP');
  const [, , deployedPath, generatedPath, mapPath] = process.argv;
  const repo = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const deployed = await realpath(deployedPath);
  const outputDir = await realpath(dirname(resolve(mapPath)));
  const deploymentRoot = dirname(dirname(deployed));
  if (within(outputDir, repo) || within(repo, outputDir) || within(outputDir, deploymentRoot) || within(deploymentRoot, outputDir)) {
    throw new Error('Map output must be isolated from repository and deployment tree');
  }
  if (!/^rolldown-runtime-[A-Za-z0-9_-]+\.js$/.test(basename(deployed))) throw new Error('Expected a Rolldown runtime asset');
  const map = await createRuntimeDebugMap(await readFile(deployed), await readFile(generatedPath, 'utf8'));
  map.file = basename(deployed);
  await writeFile(resolve(outputDir, basename(mapPath)), JSON.stringify(map), { flag: 'wx', mode: 0o600 });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Do not print file paths, source text, or dependency errors that may contain sensitive content.
    console.error('Runtime map preparation failed; check isolation, version, inputs and byte identity.');
    process.exitCode = 1;
  });
}
