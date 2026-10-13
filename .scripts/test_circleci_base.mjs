import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBase } from './circleci_base.mjs';

/** fixture creates a local Git repository, runs check with its command helper, and removes it. */
function fixture(check) {
  const cwd = mkdtempSync(join(tmpdir(), 'blog-circleci-base-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '--initial-branch=v2');
    git('config', 'user.name', 'Synthetic CI fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(cwd, 'file.txt'), 'initial\n');
    git('add', 'file.txt');
    git('commit', '-m', 'initial');
    check({ cwd, git });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('first PR build checks the complete branch against its shared v2 ancestor', () => {
  fixture(({ cwd, git }) => {
    const base = git('rev-parse', 'HEAD');
    git('checkout', '-b', 'candidate');
    git('commit', '--allow-empty', '-m', 'candidate one');
    git('commit', '--allow-empty', '-m', 'candidate two');
    git('checkout', 'v2');
    git('commit', '--allow-empty', '-m', 'concurrent v2');
    git('update-ref', 'refs/remotes/origin/v2', 'HEAD');
    git('checkout', 'candidate');
    assert.equal(resolveBase(cwd), base);
  });
});

test('v2 checkout checks the release change against its first parent', () => {
  fixture(({ cwd, git }) => {
    const parent = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'release');
    git('update-ref', 'refs/remotes/origin/v2', 'HEAD');
    assert.equal(resolveBase(cwd), parent);
  });
});

test('missing v2 ref fails closed instead of formatting an empty diff', () => {
  fixture(({ cwd }) => assert.throws(() => resolveBase(cwd)));
});

test('root-only v2 history fails closed instead of inventing a base', () => {
  fixture(({ cwd, git }) => {
    git('update-ref', 'refs/remotes/origin/v2', 'HEAD');
    assert.throws(() => resolveBase(cwd));
  });
});

test('unrelated v2 history fails closed', () => {
  fixture(({ cwd, git }) => {
    git('checkout', '--orphan', 'unrelated');
    git('rm', '-f', 'file.txt');
    git('commit', '--allow-empty', '-m', 'unrelated');
    git('update-ref', 'refs/remotes/origin/v2', 'HEAD');
    git('checkout', 'v2');
    assert.throws(() => resolveBase(cwd));
  });
});
