"""Deploy the exact Blog build through the existing Compose project."""

import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time

IMAGE = "ppcelery/laisky-blog-v2"
PROJECT = "vps"
SERVICE = "blog-v2"
DIRECTORY = pathlib.Path("/home/laisky/repo/VPS")
PUBLIC = "https://blog.laisky.com"
IMAGE_ID = re.compile(r"sha256:[0-9a-f]{64}")
ASSET = re.compile(r'<script\b[^>]*\bsrc=["\'](/assets/index-[A-Za-z0-9_-]+\.js)["\']')
PUBLIC_READ_SCRIPT = '''
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

class PublicRedirect(urllib.request.HTTPRedirectHandler):
    """PublicRedirect permits only redirects within the canonical HTTPS origin."""
    def redirect_request(self, request, response, code, message, headers, new_url):
        """redirect_request rejects an external redirect before making another request."""
        parsed = urllib.parse.urlsplit(new_url)
        if parsed.scheme != "https" or parsed.netloc != "blog.laisky.com":
            raise urllib.error.URLError("external redirect")
        return super().redirect_request(request, response, code, message, headers, new_url)

request = urllib.request.Request(sys.argv[1], headers={
    "User-Agent": "Mozilla/5.0 (Laisky Blog release verification)", "Cache-Control": "no-cache"})
limit = int(sys.argv[2])
try:
    with urllib.request.build_opener(PublicRedirect()).open(request, timeout=10) as response:
        data = response.read(limit + 1)
except urllib.error.HTTPError as error:
    sys.stderr.write(str(error.code))
    sys.exit(3)
except urllib.error.URLError as error:
    sys.exit(4 if isinstance(error.reason, ssl.SSLCertVerificationError) else 5)
except OSError:
    sys.exit(5)
if len(data) > limit:
    sys.exit(6)
sys.stdout.buffer.write(data)
'''


class DeploymentError(RuntimeError):
    """DeploymentError reports a checked release failure without command output."""


def command(arguments, timeout=10):
    """command runs argument-separated Docker commands and returns bounded output on success."""
    executable = arguments[3] if len(arguments) > 3 else ""
    operation = {
        "ps": "Blog service lookup", "inspect": "Blog container metadata inspection",
        "pull": "Candidate image pull", "image": "Immutable image inspection",
        "compose": "Compose rollout" if "up" in arguments else "Compose v2 availability check",
        "exec": "Container Nginx validation" if executable == "nginx" else "Container HTTP verification" if executable == "wget" else "Container asset read",
    }.get(arguments[1], "Docker command")
    try:
        result = subprocess.run(arguments, capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise DeploymentError(operation + " could not complete within its command bound.") from error
    if result.returncode:
        raise DeploymentError(operation + " failed with exit " + str(result.returncode) + ".")
    if len(result.stdout) > 10 * 1024 * 1024:
        raise DeploymentError("Docker command output exceeded its verification bound.")
    return result.stdout


def public_read(path, limit):
    """public_read retrieves bounded public bytes with normal TLS and a ten-second child-process deadline."""
    try:
        result = subprocess.run([sys.executable, "-c", PUBLIC_READ_SCRIPT, PUBLIC + path, str(limit)], capture_output=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise DeploymentError("Public verification could not finish within ten seconds.") from error
    if result.returncode == 3 and re.fullmatch(rb"[1-5][0-9]{2}", result.stderr):
        raise DeploymentError("Public verification returned HTTP " + result.stderr.decode("ascii") + ".")
    if result.returncode == 4:
        raise DeploymentError("Public verification failed normal TLS certificate validation.")
    if result.returncode == 6 or len(result.stdout) > limit:
        raise DeploymentError("Public verification exceeded its response bound.")
    if result.returncode:
        raise DeploymentError("Public verification could not retrieve the canonical release.")
    return result.stdout


def text(data):
    """text decodes trusted command or HTML bytes for structural verification."""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise DeploymentError("Release verification received invalid UTF-8.") from error


def asset_path(html):
    """asset_path returns the unique hashed entry script from the supplied HTML bytes."""
    matches = set(ASSET.findall(text(html)))
    if len(matches) != 1:
        raise DeploymentError("Release HTML did not identify one hashed entry script.")
    return matches.pop()


class Deployment:
    """Deployment performs one digest-pinned scoped rollout and restores the prior image on failure."""

    def __init__(self, digest, commit, run=command, fetch=public_read, sleep=time.sleep):
        """__init__ validates build identity and stores bounded command and read dependencies."""
        if not IMAGE_ID.fullmatch(digest or "") or not re.fullmatch(r"[0-9a-f]{40}", commit or ""):
            raise DeploymentError("Release digest or source commit is invalid.")
        self.reference = IMAGE + "@" + digest
        self.commit = commit
        self.run = run
        self.fetch = fetch
        self.sleep = sleep
        self.override = None

    def container(self):
        """container resolves one running Blog container and verifies its existing project labels."""
        ids = text(self.run([
            "docker", "ps", "--all", "--filter", "label=com.docker.compose.project=" + PROJECT,
            "--filter", "label=com.docker.compose.service=" + SERVICE, "--format", "{{.ID}}",
        ])).split()
        if len(ids) != 1 or not re.fullmatch(r"[0-9a-f]{12,64}", ids[0]):
            raise DeploymentError("The existing Blog service could not be identified uniquely.")
        container = ids[0]
        try:
            labels = json.loads(text(self.run(["docker", "inspect", "--format", "{{json .Config.Labels}}", container])))
        except (ValueError, TypeError) as error:
            raise DeploymentError("The Blog project labels could not be decoded.") from error
        if not isinstance(labels, dict) or labels.get("com.docker.compose.project") != PROJECT or labels.get("com.docker.compose.service") != SERVICE:
            raise DeploymentError("The Blog container does not belong to the expected project.")
        directory = labels.get("com.docker.compose.project.working_dir", "")
        if not isinstance(directory, str) or pathlib.Path(directory) != DIRECTORY:
            raise DeploymentError("The Blog project directory does not match the existing release target.")
        state = text(self.run(["docker", "inspect", "--format", "{{.Image}} {{.State.Running}}", container])).split()
        if len(state) != 2 or not IMAGE_ID.fullmatch(state[0]) or state[1] != "true":
            raise DeploymentError("The Blog container is not running an identifiable immutable image.")
        return container, state[0]

    def compose(self, *arguments):
        """compose builds commands using the existing project identity and one temporary override."""
        return [
            "docker", "compose", "--project-name", PROJECT, "--project-directory", str(DIRECTORY),
            "-f", str(DIRECTORY / "b1-docker-compose.yml"), "-f", str(self.override), *arguments,
        ]

    def rollout(self, image):
        """rollout recreates only Blog with a local immutable image and preserves dependencies and orphans."""
        self.override.write_text(json.dumps({"services": {SERVICE: {"image": image}}}))
        self.run(self.compose("up", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", "-d", SERVICE), timeout=90)

    def snapshot(self, expected_image):
        """snapshot verifies the running image and Nginx and returns its hashed entry script and SHA256."""
        container, image = self.container()
        if image != expected_image:
            raise DeploymentError("The running Blog image does not match the selected immutable image.")
        self.run(["docker", "exec", container, "nginx", "-t"], timeout=10)
        path = asset_path(self.run(["docker", "exec", container, "cat", "/app/index.html"], timeout=10))
        data = self.run(["docker", "exec", container, "cat", "/app" + path], timeout=10)
        if not data:
            raise DeploymentError("The running Blog entry script is empty.")
        digest = hashlib.sha256(data).hexdigest()
        served_html = self.run(["docker", "exec", container, "wget", "-q", "-T", "5", "-O", "-", "http://127.0.0.1/"], timeout=10)
        if len(served_html) > 256 * 1024 or asset_path(served_html) != path:
            raise DeploymentError("Container HTTP HTML does not select its local entry script.")
        served_asset = self.run(["docker", "exec", container, "wget", "-q", "-T", "5", "-O", "-", "http://127.0.0.1" + path], timeout=10)
        if hashlib.sha256(served_asset).hexdigest() != digest:
            raise DeploymentError("Container HTTP JavaScript differs from its local entry script.")
        return path, digest

    def verify_public(self, snapshot):
        """verify_public requires public HTML and entry script bytes to match the running release."""
        path, digest = snapshot
        html = self.fetch("/?release=" + self.commit, 256 * 1024)
        if asset_path(html) != path:
            raise DeploymentError("Public HTML still selects another Blog release.")
        if hashlib.sha256(self.fetch(path, 10 * 1024 * 1024)).hexdigest() != digest:
            raise DeploymentError("The public Blog entry script differs from the running release.")

    def accept(self, image):
        """accept retries bounded startup and public verification and returns the accepted asset identity."""
        failure = None
        for attempt in range(3):
            try:
                snapshot = self.snapshot(image)
                self.verify_public(snapshot)
                return snapshot
            except DeploymentError as error:
                failure = error
                if attempt < 2:
                    self.sleep(2)
        raise failure

    def deploy(self):
        """deploy validates preconditions, rolls out the exact build, and fails even after successful rollback."""
        version = text(self.run(["docker", "compose", "version", "--short"])).strip().lstrip("v")
        if not re.fullmatch(r"2\.\d+\.\d+(?:[-+].*)?", version):
            raise DeploymentError("The release requires the already-installed Compose v2 command.")
        _, previous = self.container()
        prior = text(self.run(["docker", "image", "inspect", previous, "--format", "{{.Id}}"])).strip()
        if prior != previous:
            raise DeploymentError("The prior immutable Blog image is unavailable for rollback.")
        self.run(["docker", "pull", self.reference], timeout=180)
        candidate = text(self.run(["docker", "image", "inspect", self.reference, "--format", "{{.Id}}"])).strip()
        revision = text(self.run(["docker", "image", "inspect", self.reference, "--format", '{{index .Config.Labels "org.opencontainers.image.revision"}}'])).strip()
        if not IMAGE_ID.fullmatch(candidate) or revision != self.commit:
            raise DeploymentError("The built image identity does not match this source commit.")
        with tempfile.TemporaryDirectory(prefix="blog-release-") as directory:
            self.override = pathlib.Path(directory) / "image.json"
            try:
                self.rollout(self.reference)
                snapshot = self.accept(candidate)
            except DeploymentError as failure:
                try:
                    self.rollout(previous)
                    self.accept(previous)
                except DeploymentError as rollback:
                    raise DeploymentError("Blog rollout failed: " + str(failure) + " Rollback verification also failed: " + str(rollback)) from rollback
                raise DeploymentError("Blog rollout failed; the prior immutable image was restored and verified. " + str(failure)) from failure
        return snapshot


def main():
    """main deploys the workflow-provided identity and returns a nonzero exit for every failed release."""
    try:
        deployment = Deployment(os.environ.get("BLOG_DEPLOY_DIGEST"), os.environ.get("BLOG_DEPLOY_COMMIT"))
        asset, digest = deployment.deploy()
    except DeploymentError as error:
        print(str(error), flush=True)
        return 1
    print("Verified Blog release " + deployment.commit + " " + asset + " sha256:" + digest, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
