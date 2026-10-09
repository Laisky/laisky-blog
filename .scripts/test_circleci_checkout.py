"""Behavioral controls exercise the checkout command embedded in CircleCI."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

PUBLIC_URL = "https://github.com/Laisky/laisky-blog.git"
CONFIG = Path(__file__).resolve().parents[1] / ".circleci/config.yml"


def checkout_command():
    """checkout_command returns the actual CircleCI checkout shell command."""
    lines = CONFIG.read_text().splitlines()
    start = lines.index("          name: Checkout the exact public commit over HTTPS") + 2
    command = []
    for line in lines[start:]:
        if line and not line.startswith("            "):
            break
        command.append(line[12:])
    return "\n".join(command)


class CheckoutTests(unittest.TestCase):
    """CheckoutTests use local native Git objects behind an inert HTTPS transport shim."""

    def setUp(self):
        """setUp creates isolated Git history and a recording local transport shim."""
        self.temp = tempfile.TemporaryDirectory(prefix="blog-checkout-control-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        source = self.root / "source"
        source.mkdir()
        self.real_git = shutil.which("git")
        clean = dict(os.environ, GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
        for key in list(clean):
            if key.startswith("GIT_CONFIG_") and key not in {"GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_GLOBAL"}:
                clean.pop(key)

        def git(*args):
            """git runs native commands against the local synthetic source."""
            return subprocess.check_output(
                [self.real_git, *args], cwd=source, env=clean,
                text=True, stderr=subprocess.DEVNULL,
            ).strip()

        git("init", "--initial-branch=v2")
        git("config", "user.name", "Synthetic checkout fixture")
        git("config", "user.email", "fixture@example.invalid")
        (source / "file.txt").write_text("base\n")
        git("add", "file.txt")
        git("commit", "-m", "base")
        self.base = git("rev-parse", "HEAD")
        git("checkout", "-b", "candidate")
        (source / "file.txt").write_text("candidate\n")
        git("commit", "-am", "candidate")
        self.sha = git("rev-parse", "HEAD")
        self.remote = self.root / "remote.git"
        subprocess.run(
            [self.real_git, "clone", "--quiet", "--bare", str(source), str(self.remote)],
            env=clean, check=True, capture_output=True,
        )
        self.record = self.root / "calls.jsonl"
        self.ambient = self.root / "ambient"
        self.ambient.mkdir()
        (self.ambient / ".netrc").write_text("machine github.com login inert-fixture\n")
        global_config = self.ambient / ".gitconfig"
        global_config.write_text(
            '[credential]\n\thelper = !false\n[http]\n\textraHeader = inert-fixture\n'
            '[url "ssh://blocked.invalid/"]\n\tinsteadOf = ' + PUBLIC_URL + "\n"
        )
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        wrapper = bin_dir / "git"
        wrapper.write_text(
            "#!" + sys.executable + "\n" +
            "import json, os, subprocess, sys\n"
            "from pathlib import Path\n"
            "args = sys.argv[1:]\n"
            "assert args[:6] == ['-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false']\n"
            "assert os.environ.get('GIT_CONFIG_GLOBAL') == '/dev/null'\n"
            "assert os.environ.get('GIT_CONFIG_NOSYSTEM') == '1'\n"
            "assert os.environ.get('GIT_TERMINAL_PROMPT') == '0'\n"
            "assert os.environ.get('GIT_ASKPASS') == '/bin/false'\n"
            "assert os.environ.get('SSH_ASKPASS') == '/bin/false'\n"
            "assert 'GIT_CONFIG_PARAMETERS' not in os.environ\n"
            "assert 'GIT_CONFIG_COUNT' not in os.environ\n"
            "assert os.environ['HOME'] != os.environ['FIXTURE_AMBIENT_HOME']\n"
            "assert not (Path(os.environ['HOME']) / '.netrc').exists()\n"
            "with open(os.environ['FIXTURE_RECORD'], 'a') as record:\n"
            " record.write(json.dumps(args) + '\\n')\n"
            "if args[6] == 'fetch':\n"
            " assert args[7:10] == ['--quiet', '--no-tags', 'origin']\n"
            " assert args[10] == os.environ['CIRCLE_SHA1']\n"
            " args[9] = os.environ['FIXTURE_REMOTE']\n"
            " if os.environ.get('FIXTURE_WRONG_FETCH') == '1':\n"
            "  args[10] = os.environ['FIXTURE_BASE']\n"
            "sys.exit(subprocess.call([os.environ['FIXTURE_REAL_GIT'], *args]))\n"
        )
        wrapper.chmod(0o700)
        self.env = dict(
            os.environ, PATH=str(bin_dir) + ":" + os.environ["PATH"],
            HOME=str(self.ambient), CIRCLE_SHA1=self.sha,
            GIT_CONFIG_GLOBAL=str(global_config), GIT_CONFIG_COUNT="1",
            GIT_CONFIG_KEY_0="http.extraHeader", GIT_CONFIG_VALUE_0="inert-fixture",
            GIT_CONFIG_PARAMETERS="'http.extraHeader=inert-fixture'",
            FIXTURE_AMBIENT_HOME=str(self.ambient), FIXTURE_RECORD=str(self.record),
            FIXTURE_REMOTE=str(self.remote), FIXTURE_REAL_GIT=self.real_git,
            FIXTURE_BASE=self.base,
        )

    def run_checkout(self, **overrides):
        """run_checkout executes the repository's actual command with bounded local mocks."""
        return subprocess.run(
            ["bash", "-c", checkout_command()], cwd=self.workspace,
            env=dict(self.env, **overrides), text=True, capture_output=True, timeout=10,
        )

    def test_exact_public_sha_is_fetched_and_detached_without_ambient_auth(self):
        """test_exact_public_sha_is_fetched_and_detached_without_ambient_auth verifies real Git state."""
        result = self.run_checkout()
        self.assertEqual(result.returncode, 0, result.stderr)
        clean = dict(os.environ, GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_NOSYSTEM="1")
        head = subprocess.check_output(
            [self.real_git, "rev-parse", "HEAD"], cwd=self.workspace, env=clean, text=True
        ).strip()
        self.assertEqual(head, self.sha)
        detached = subprocess.run(
            [self.real_git, "symbolic-ref", "--quiet", "HEAD"],
            cwd=self.workspace, env=clean, capture_output=True,
        )
        self.assertEqual(detached.returncode, 1)
        origin = subprocess.check_output(
            [self.real_git, "config", "--local", "remote.origin.url"],
            cwd=self.workspace, env=clean, text=True,
        ).strip()
        self.assertEqual(origin, PUBLIC_URL)
        self.assertEqual((self.workspace / "file.txt").read_text(), "candidate\n")
        calls = [json.loads(line)[6:] for line in self.record.read_text().splitlines()]
        self.assertIn(["remote", "add", "origin", PUBLIC_URL], calls)
        fetch = next(row for row in calls if row[0] == "fetch")
        self.assertEqual(fetch[-2:], [self.sha, "+refs/heads/v2:refs/remotes/origin/v2"])

    def test_malformed_or_zero_sha_fails_before_any_git_command(self):
        """test_malformed_or_zero_sha_fails_before_any_git_command rejects untrusted revision input."""
        for sha in ["", "0" * 40, "--upload-pack=unexpected", "a" * 39, "A" * 40]:
            with self.subTest(sha=sha):
                self.assertNotEqual(self.run_checkout(CIRCLE_SHA1=sha).returncode, 0)
                self.assertFalse(self.record.exists())
                self.assertFalse((self.workspace / ".git").exists())

    def test_wrong_fetch_does_not_silently_checkout_another_commit(self):
        """test_wrong_fetch_does_not_silently_checkout_another_commit rejects unavailable requested objects."""
        self.assertNotEqual(self.run_checkout(FIXTURE_WRONG_FETCH="1").returncode, 0)
        self.assertFalse((self.workspace / "file.txt").exists())

    def test_existing_repository_is_not_overwritten(self):
        """test_existing_repository_is_not_overwritten preserves an unexpected existing checkout."""
        existing = self.workspace / ".git"
        existing.mkdir()
        marker = existing / "inert-marker"
        marker.write_text("preserve\n")
        self.assertNotEqual(self.run_checkout().returncode, 0)
        self.assertEqual(marker.read_text(), "preserve\n")
        self.assertFalse(self.record.exists())


if __name__ == "__main__":
    unittest.main()
