"""Behavioral controls for the scoped Blog release helper."""

import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
import unittest
from unittest import mock

from deploy_blog import Deployment, DeploymentError, DIRECTORY, IMAGE, PROJECT, SERVICE, command, public_read

ROOT = pathlib.Path(__file__).resolve().parents[1]
COMMIT = "a" * 40
DIGEST = "sha256:" + "b" * 64
PRIOR = "sha256:" + "c" * 64
CANDIDATE = "sha256:" + "d" * 64


def release_script():
    """release_script returns the checked-in remote release shell script."""
    source = (ROOT / ".github/workflows/ci.yml").read_text()
    return re.search(r"          script: \|\n((?:            .*\n?)+)", source).group(1).replace("            ", "")


def guard_script():
    """guard_script returns the checked-in current-branch guard shell script."""
    source = (ROOT / ".github/workflows/ci.yml").read_text()
    return re.search(r"      - name: Reject superseded release\n[\s\S]*?        run: \|\n((?:          [^\n]*\n?)+)", source).group(1).replace("          ", "")


class FakeDocker:
    """FakeDocker models image changes and public delivery without running Docker or making requests."""

    def __init__(self):
        """__init__ initializes the prior image, command receipts, and optional failure controls."""
        self.current = PRIOR
        self.commands = []
        self.rollouts = []
        self.public_reads = []
        self.fail_up = False
        self.partial_up_failure = False
        self.fail_rollback = False
        self.fail_pull = False
        self.fail_nginx = False
        self.fail_public = False
        self.stale_public = False
        self.corrupt_bundle = False
        self.mismatch = False
        self.revision = COMMIT
        self.version = "2.39.4"
        self.container_ids = "123456abcdef\n"
        self.labels = {"com.docker.compose.project": PROJECT, "com.docker.compose.service": SERVICE, "com.docker.compose.project.working_dir": str(DIRECTORY)}

    def run(self, arguments, timeout=10):
        """run records checked Docker arguments and emulates only the release helper's operations."""
        self.commands.append((arguments, timeout))
        if arguments[1:4] == ["compose", "version", "--short"]:
            return self.version.encode()
        if arguments[1] == "ps":
            return self.container_ids.encode()
        if arguments[1] == "inspect":
            if arguments[3] == "{{json .Config.Labels}}":
                return json.dumps(self.labels).encode()
            image = "sha256:" + "e" * 64 if self.mismatch and self.current == CANDIDATE else self.current
            return (image + " true").encode()
        if arguments[1] == "pull":
            if self.fail_pull:
                raise DeploymentError("Mock pull failure.")
            return b"pulled"
        if arguments[1:3] == ["image", "inspect"]:
            if arguments[5] != "{{.Id}}":
                return self.revision.encode()
            return (PRIOR if arguments[3] == PRIOR else CANDIDATE).encode()
        if arguments[1] == "compose":
            override = pathlib.Path(arguments[arguments.index("-f", arguments.index("-f") + 1) + 1])
            data = json.loads(override.read_text())
            self.rollouts.append(data)
            image = data["services"][SERVICE]["image"]
            if image != PRIOR and self.partial_up_failure:
                self.current = CANDIDATE
                raise DeploymentError("Mock Compose failure after replacing the prior container.")
            if image == PRIOR and self.fail_rollback or image != PRIOR and self.fail_up:
                raise DeploymentError("Mock Compose failure.")
            self.current = PRIOR if image == PRIOR else CANDIDATE
            return b"started"
        if arguments[1] == "exec":
            if arguments[3] == "nginx":
                if self.fail_nginx and self.current == CANDIDATE:
                    raise DeploymentError("Mock Nginx failure.")
                return b"configuration test successful"
            if arguments[3] == "wget":
                return self.html(self.current) if arguments[-1].endswith("/") else self.bundle(self.current)
            if arguments[4] == "/app/index.html":
                return self.html(self.current)
            return self.bundle(self.current)
        raise AssertionError("Unexpected mock command: " + repr(arguments))

    def html(self, image):
        """html returns a harmless entry-script reference for the selected simulated image."""
        label = "old" if image == PRIOR else "new"
        return ('<script type="module" src="/assets/index-' + label + '.js"></script>').encode()

    def bundle(self, image):
        """bundle returns inert JavaScript bytes with distinct identities for old and new images."""
        return b"/* old bundle */" if image == PRIOR else b"/* new bundle */"

    def fetch(self, path, limit):
        """fetch simulates public HTML or bundle bytes and records every bounded read."""
        self.public_reads.append((path, limit))
        if self.fail_public:
            raise DeploymentError("Mock TLS or transport failure.")
        image = PRIOR if self.stale_public else self.current
        if self.corrupt_bundle and image == CANDIDATE and not path.startswith("/?"):
            return b"/* different public bytes */"
        return self.html(image) if path.startswith("/?") else self.bundle(image)

    def deploy(self):
        """deploy runs the real deployment control flow against local mock dependencies."""
        return Deployment(DIGEST, COMMIT, run=self.run, fetch=self.fetch, sleep=lambda _: None).deploy()


class ReleaseFailureTests(unittest.TestCase):
    """ReleaseFailureTests checks that failed rollout and branch lookup cannot become success."""

    def test_release_script_preserves_rollout_failure(self):
        """test_release_script_preserves_rollout_failure rejects the old trailing-ps success."""
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "docker").write_text("#!/bin/sh\nexit 0\n")
            (path / "docker-compose").write_text("#!/bin/sh\necho 'services.derper.volumes create_host_path is unsupported' >&2\nexit 1\n")
            (path / "python3").write_text("#!/bin/sh\nexit 1\n")
            for executable in path.iterdir():
                executable.chmod(0o755)
            script = release_script().replace("cd /home/laisky/repo/VPS", "cd " + directory)
            result = subprocess.run(["/bin/sh", "-c", script], env={**os.environ, "PATH": directory + ":" + os.environ["PATH"]}, capture_output=True, text=True, timeout=5)
            self.assertNotEqual(result.returncode, 0, "The failed Compose rollout was masked by docker ps.")

    def test_branch_guard_skips_old_commits_and_fails_closed(self):
        """test_branch_guard_skips_old_commits_and_fails_closed models reordered and failed branch lookups."""
        for remote, exit_code, expected in [(COMMIT, 0, "deploy=true"), ("f" * 40, 0, "deploy=false"), ("", 1, None), ("malformed", 0, None)]:
            with self.subTest(remote=remote, exit_code=exit_code), tempfile.TemporaryDirectory() as directory:
                path = pathlib.Path(directory)
                gh = path / "gh"
                gh.write_text("#!/bin/sh\nprintf '%s\\n' '" + remote + "'\nexit " + str(exit_code) + "\n")
                gh.chmod(0o755)
                output = path / "output"
                env = {**os.environ, "PATH": directory + ":" + os.environ["PATH"], "GITHUB_SHA": COMMIT, "GITHUB_REPOSITORY": "Laisky/laisky-blog", "GITHUB_OUTPUT": str(output)}
                result = subprocess.run(["bash", "-c", guard_script()], env=env, capture_output=True, text=True, timeout=5)
                if expected is None:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())
                else:
                    self.assertEqual(result.returncode, 0)
                    self.assertEqual(output.read_text().strip(), expected)


class DeploymentTests(unittest.TestCase):
    """DeploymentTests verifies exact image identity, scoped rollout, public delivery, and rollback."""

    def test_success_is_digest_pinned_scoped_and_publicly_verified(self):
        """test_success_is_digest_pinned_scoped_and_publicly_verified checks the real command and artifact contract."""
        fake = FakeDocker()
        asset, digest = fake.deploy()
        self.assertEqual(asset, "/assets/index-new.js")
        self.assertEqual(digest, hashlib.sha256(fake.bundle(CANDIDATE)).hexdigest())
        self.assertEqual(fake.rollouts, [{"services": {SERVICE: {"image": IMAGE + "@" + DIGEST}}}])
        up = next(command for command, _ in fake.commands if "up" in command)
        self.assertEqual(up[up.index("up"):], ["up", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "-d", SERVICE])
        self.assertEqual(up[up.index("--project-name") + 1], PROJECT)
        self.assertNotIn("--remove-orphans", up)
        self.assertFalse(pathlib.Path(up[up.index("-f", up.index("-f") + 1) + 1]).exists())
        self.assertEqual(len(fake.public_reads), 2)

    def test_rollout_and_acceptance_failures_restore_prior_immutable_image(self):
        """test_rollout_and_acceptance_failures_restore_prior_immutable_image keeps each failed release nonzero."""
        for flag in ["fail_up", "partial_up_failure", "fail_nginx", "mismatch", "stale_public", "corrupt_bundle"]:
            with self.subTest(failure=flag):
                fake = FakeDocker()
                setattr(fake, flag, True)
                with self.assertRaisesRegex(DeploymentError, "prior immutable image was restored"):
                    fake.deploy()
                self.assertEqual(fake.current, PRIOR)
                self.assertEqual(fake.rollouts[-1], {"services": {SERVICE: {"image": PRIOR}}})

    def test_rollback_failure_remains_failure(self):
        """test_rollback_failure_remains_failure surfaces both rollout and restoration failure."""
        fake = FakeDocker()
        fake.fail_up = fake.fail_rollback = True
        with self.assertRaisesRegex(DeploymentError, "Rollback verification also failed"):
            fake.deploy()

    def test_public_transport_failure_is_not_certificate_bypassed(self):
        """test_public_transport_failure_is_not_certificate_bypassed fails release and rollback verification."""
        fake = FakeDocker()
        fake.fail_public = True
        with self.assertRaisesRegex(DeploymentError, "Rollback verification also failed"):
            fake.deploy()
        self.assertEqual(fake.current, PRIOR)

    def test_preflight_failures_do_not_recreate_any_service(self):
        """test_preflight_failures_do_not_recreate_any_service rejects invalid identity and missing prerequisites."""
        for flag, value in [("fail_pull", True), ("revision", "f" * 40), ("version", "1.28.4"), ("container_ids", ""), ("container_ids", "123456abcdef\nfedcba654321\n")]:
            with self.subTest(failure=flag, value=value):
                fake = FakeDocker()
                setattr(fake, flag, value)
                with self.assertRaises(DeploymentError):
                    fake.deploy()
                self.assertEqual(fake.rollouts, [])

    def test_project_mismatch_does_not_recreate_any_service(self):
        """test_project_mismatch_does_not_recreate_any_service preserves other projects and directories."""
        for key in ["com.docker.compose.project", "com.docker.compose.service", "com.docker.compose.project.working_dir"]:
            with self.subTest(label=key):
                fake = FakeDocker()
                fake.labels[key] = "other"
                with self.assertRaises(DeploymentError):
                    fake.deploy()
                self.assertEqual(fake.rollouts, [])

    def test_invalid_inputs_cannot_become_command_arguments(self):
        """test_invalid_inputs_cannot_become_command_arguments rejects malformed digest and commit inputs."""
        for digest, commit in [("latest", COMMIT), (DIGEST + ";false", COMMIT), (DIGEST, "main"), (DIGEST, COMMIT + "\n")]:
            with self.subTest(digest=digest, commit=commit), self.assertRaises(DeploymentError):
                Deployment(digest, commit)

    def test_command_failure_reports_only_fixed_operation_and_exit(self):
        """test_command_failure_reports_only_fixed_operation_and_exit excludes private command output."""
        result = subprocess.CompletedProcess([], 1, b"private output", b"private settings")
        with mock.patch("deploy_blog.subprocess.run", return_value=result), self.assertRaisesRegex(DeploymentError, r"^Candidate image pull failed with exit 1\.$"):
            command(["docker", "pull", IMAGE + "@" + DIGEST])

    def test_public_read_has_a_total_process_deadline(self):
        """test_public_read_has_a_total_process_deadline prevents slow HTTP from consuming rollback time."""
        with mock.patch("deploy_blog.subprocess.run", side_effect=subprocess.TimeoutExpired("python3", 10)) as run:
            with self.assertRaisesRegex(DeploymentError, "within ten seconds"):
                public_read("/?release=" + COMMIT, 256 * 1024)
            self.assertEqual(run.call_args.kwargs["timeout"], 10)

    def test_public_read_rejects_tls_and_oversize_without_exposing_output(self):
        """test_public_read_rejects_tls_and_oversize_without_exposing_output keeps failures bounded and sanitized."""
        for result, message in [(subprocess.CompletedProcess([], 4, b"", b"private detail"), "normal TLS certificate"), (subprocess.CompletedProcess([], 0, b"x" * 20, b""), "response bound")]:
            with self.subTest(message=message), mock.patch("deploy_blog.subprocess.run", return_value=result):
                with self.assertRaisesRegex(DeploymentError, message):
                    public_read("/", 10)


if __name__ == "__main__":
    unittest.main()
