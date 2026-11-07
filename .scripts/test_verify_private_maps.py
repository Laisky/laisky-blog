"""Exercise private source-map isolation and byte-identity checks."""

import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('verify_private_maps', Path(__file__).with_name('verify_private_maps.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VerifyPrivateMapsTest(unittest.TestCase):
    """Check accepted builds and failure cases with synthetic artifacts."""

    def setUp(self):
        """Create isolated deploy and map trees with matching synthetic JavaScript."""
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.repo = root / 'repo'
        self.public = self.repo / 'dist'
        self.private = root / 'private'
        self.public.mkdir(parents=True)
        self.private.mkdir()
        self.script = 'app.js'
        (self.public / self.script).write_text('console.log(1)')
        (self.private / self.script).write_text('console.log(1)')
        (self.private / 'app.js.map').write_text(json.dumps({'version': 3, 'sources': ['src/app.js'], 'mappings': 'AAAA'}))

    def check(self):
        """Run the verifier with the current synthetic trees."""
        return module.verify(self.public, self.private, self.repo)

    def test_matching_builds(self):
        """Accept matching scripts and return hashes without map contents."""
        result = self.check()
        self.assertEqual(result[0]['asset_path_sha256'], hashlib.sha256(b'app.js').hexdigest())
        self.assertEqual(len(result[0]['sha256']), 64)
        self.assertNotIn('sources', json.dumps(result))

    def test_manifest_does_not_emit_map_contents(self):
        """Keep synthetic source contents out of the hash-only manifest."""
        canaries = ['query=TOKEN', 'cookie', 'account', 'user', 'ip', 'request body', 'response body', 'DOM', 'storage']
        (self.private / 'app.js.map').write_text(json.dumps({
            'version': 3, 'sources': ['src/app.js'], 'mappings': 'AAAA', 'sourcesContent': [' '.join(canaries)]
        }))
        output = json.dumps(self.check())
        for canary in canaries:
            self.assertNotIn(canary, output)

    def test_manifest_hides_asset_filename(self):
        """Hash file paths so attacker-controlled names do not appear in the output."""
        canary = 'TOKEN_COOKIE_ACCOUNT_USER_IP_BODY_DOM_STORAGE'
        (self.public / (canary + '.js')).write_text('export {}')
        (self.private / (canary + '.js')).write_text('export {}')
        (self.private / (canary + '.js.map')).write_text(json.dumps({
            'version': 3, 'sources': ['source'], 'mappings': 'AAAA'
        }))
        self.assertNotIn(canary, json.dumps(self.check()))

    def test_reject_mismatched_bytes(self):
        """Reject an independently generated build with different script bytes."""
        (self.private / self.script).write_text('console.log(2)')
        with self.assertRaisesRegex(ValueError, 'bytes differ'):
            self.check()

    def test_reject_public_or_missing_map(self):
        """Reject maps in the served tree and missing private maps."""
        (self.public / 'app.js.map').write_text('secret')
        with self.assertRaisesRegex(ValueError, 'deployment tree'):
            self.check()
        (self.public / 'app.js.map').unlink()
        (self.private / 'app.js.map').unlink()
        with self.assertRaisesRegex(ValueError, 'map set'):
            self.check()

    def test_reject_unisolated_and_links(self):
        """Reject private output inside the repository and symlinked build files."""
        with self.assertRaisesRegex(ValueError, 'outside'):
            module.verify(self.public, self.public, self.repo)
        (self.private / 'link').symlink_to(self.public / self.script)
        with self.assertRaisesRegex(ValueError, 'symbolic links'):
            self.check()

    def test_record_unmapped_script(self):
        """Record mapless scripts explicitly while still comparing their bytes."""
        (self.public / 'wrapper.js').write_text('export {}')
        (self.private / 'wrapper.js').write_text('export {}')
        with self.assertRaisesRegex(ValueError, 'unqualified mapless'):
            self.check()
        qualified = {'wrapper.js': hashlib.sha256(b'export {}').hexdigest()}
        result = module.verify(self.public, self.private, self.repo, qualified)
        self.assertIsNone(result[1]['map_sha256'])
        (self.private / 'wrapper.js').write_text('unmapped executable')
        (self.public / 'wrapper.js').write_text('unmapped executable')
        with self.assertRaisesRegex(ValueError, 'unqualified mapless'):
            module.verify(self.public, self.private, self.repo, qualified)

    def test_reject_invalid_map(self):
        """Reject a map that lacks source positions."""
        for value in [
            {'version': 3, 'sources': [], 'mappings': ''},
            {'version': 3, 'sources': [1], 'mappings': 'AAAA'},
            {'version': 3, 'sources': ['app.js'], 'mappings': 1},
            {'version': 3, 'sources': ['app.js'], 'mappings': '%%%invalid'},
            {'version': 3, 'sources': ['app.js'], 'mappings': 'AAAA', 'sourcesContent': []},
        ]:
            (self.private / 'app.js.map').write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, 'invalid or empty'):
                self.check()


if __name__ == '__main__':
    unittest.main()
