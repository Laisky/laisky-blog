"""Test identity generation from synthetic verified script records."""

import hashlib
import unittest
from create_offline_sentry_config import create_config


class ConfigTest(unittest.TestCase):
    """Check identity stability and reject invalid or sensitive input."""

    def setUp(self):
        """Provide two synthetic asset records and validated metadata."""
        self.paths = ['assets/a.js', 'assets/b.js']
        self.records = [{'asset_path_sha256': hashlib.sha256(path.encode()).hexdigest(), 'sha256': char * 64}
                        for path, char in zip(self.paths, 'ab')]
        self.args = ('c' * 40, 'staging', 'https://blog.example')

    def test_canonical_identity(self):
        """Generate the same identity in either record order and change it when bytes change."""
        first = create_config(self.records, self.paths, self.paths, *self.args)
        self.assertEqual(first, create_config(list(reversed(self.records)), self.paths, self.paths, *self.args))
        changed = [dict(record) for record in self.records]
        changed[0]['sha256'] = 'd' * 64
        self.assertNotEqual(first['build'], create_config(changed, self.paths, self.paths, *self.args)['build'])
        self.assertEqual(first['assets'], ['/assets/a.js', '/assets/b.js'])
        with self.assertRaisesRegex(ValueError, 'reviewed allowlist'):
            create_config(self.records, self.paths, ['assets/a.js'], *self.args)

    def test_rejected_inputs(self):
        """Reject untrusted paths, duplicate assets, malformed identities and unsafe origins."""
        for records, paths, args in [
            ([{'asset_path_sha256': hashlib.sha256(b'assets/token?SECRET.js').hexdigest(), 'sha256': 'a' * 64}], ['assets/token?SECRET.js'], self.args),
            (self.records + self.records, self.paths, self.args),
            (self.records, self.paths, ('short', 'staging', 'https://blog.example')),
            (self.records, self.paths, ('c' * 40, 'unknown', 'https://blog.example')),
            (self.records, self.paths, ('c' * 40, 'staging', 'https://user:token@blog.example')),
            (self.records, self.paths, ('c' * 40, 'staging', 'https://blog.example/?token=secret')),
        ]:
            with self.subTest(records=records, args=args), self.assertRaises(ValueError):
                create_config(records, paths, paths, *args)


if __name__ == '__main__':
    unittest.main()
