import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBase } from './fast_ci.mjs';

/** resolveBase returns the verified comparison commit for a CircleCI checkout in cwd. */
export function resolveBase(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = git('rev-parse', '--verify', 'HEAD^{commit}');
  const target = git('rev-parse', '--verify', 'refs/remotes/origin/v2^{commit}');
  const base = validateBase(head === target ? git('rev-parse', '--verify', 'HEAD^1^{commit}') : git('merge-base', head, target));
  git('merge-base', '--is-ancestor', base, head);
  return base;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(`${resolveBase()}\n`);
}
