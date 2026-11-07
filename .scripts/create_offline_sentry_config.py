#!/usr/bin/env python3
"""Prepare an offline Sentry adapter configuration for verified script bytes."""

import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from verify_private_maps import files, verify


ASSET = re.compile(r'assets/[A-Za-z0-9_.-]+\.js\Z')


def create_config(records, asset_paths, approved_paths, commit, environment, origin):
    """Return a validated adapter configuration bound to the verified script-set hashes."""
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('commit must be a full lowercase Git SHA')
    if environment not in ('production', 'staging', 'development'):
        raise ValueError('unknown environment')
    url = urlsplit(origin)
    if (url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password
            or url.path or url.query or url.fragment or url.netloc != url.netloc.lower()):
        raise ValueError('origin must be a clean lowercase HTTP(S) origin')
    names = {hashlib.sha256(name.encode('utf-8')).hexdigest(): name for name in asset_paths}
    if len(names) != len(asset_paths) or len(records) != len(names):
        raise ValueError('script paths do not match verified records')
    if len(approved_paths) != len(set(approved_paths)) or set(asset_paths) != set(approved_paths):
        raise ValueError('asset paths require an exact reviewed allowlist')
    entries = sorted((names[record['asset_path_sha256']], record['sha256']) for record in records)
    if not entries or len({name for name, _ in entries}) != len(entries):
        raise ValueError('script set must be nonempty and unique')
    if any(not ASSET.fullmatch(name) or not re.fullmatch(r'[0-9a-f]{64}', sha) for name, sha in entries):
        raise ValueError('invalid script filename or digest')
    # This digest identifies the script set, not the HTML, CSS, image or complete deployment.
    payload = json.dumps(entries, ensure_ascii=True, separators=(',', ':')).encode('ascii')
    return {'commit': commit, 'build': hashlib.sha256(payload).hexdigest(), 'environment': environment,
            'origin': origin, 'assets': ['/' + name for name, _ in entries]}


def main():
    """Verify build trees and print a candidate configuration without enabling the SDK."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('deployment', type=Path)
    parser.add_argument('private_build', type=Path)
    parser.add_argument('--approved-assets', type=Path, required=True,
                        help='JSON array of reviewed relative script paths; these paths will be printed')
    parser.add_argument('--commit', required=True)
    parser.add_argument('--environment', required=True)
    parser.add_argument('--origin', required=True)
    args = parser.parse_args()
    try:
        records = verify(args.deployment, args.private_build, Path(__file__).resolve().parent.parent)
        print(json.dumps(create_config(records, [name for name in files(args.deployment).keys() if name.endswith('.js')],
                                       json.loads(args.approved_assets.read_text(encoding='utf-8')), args.commit, args.environment, args.origin), indent=2))
    except (OSError, ValueError, TypeError, json.JSONDecodeError, KeyError) as error:
        parser.exit(1, f'Configuration rejected: {error}\n')


if __name__ == '__main__':
    main()
