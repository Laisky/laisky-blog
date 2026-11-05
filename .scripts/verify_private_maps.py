#!/usr/bin/env python3
"""Verify an offline hidden-map build against the exact deployable assets."""

import argparse
import hashlib
import json
from pathlib import Path


def files(root):
    """Return regular files by relative path, rejecting links that could escape the tree."""
    result = {}
    for item in root.rglob('*'):
        if item.is_symlink():
            raise ValueError('symbolic links are not allowed in build trees')
        if item.is_file():
            result[item.relative_to(root).as_posix()] = item
    return result


def digest(path):
    """Return the SHA-256 digest of a file's bytes."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(public, private, repository):
    """Return asset and map hashes only when both build trees meet isolation and identity checks."""
    public, private, repository = (p.resolve(strict=True) for p in (public, private, repository))
    if not public.is_dir() or not private.is_dir() or not repository.is_dir():
        raise ValueError('all inputs must be directories')
    if (private.is_relative_to(repository) or repository.is_relative_to(private)
            or public.is_relative_to(private) or private.is_relative_to(public)):
        raise ValueError('private build must be outside the repository and deployment tree')
    deployed, mapped = files(public), files(private)
    if any(name.endswith('.map') for name in deployed):
        raise ValueError('deployment tree contains a source map')
    scripts = sorted(name for name in deployed if name.endswith('.js'))
    if not scripts:
        raise ValueError('deployment tree contains no JavaScript assets')
    maps = sorted(name for name in mapped if name.endswith('.map'))
    if not maps or any(name[:-4] not in scripts for name in maps):
        raise ValueError('private map set is empty or has no corresponding deployment script')
    if sorted(name for name in mapped if name.endswith('.js')) != scripts:
        raise ValueError('private and deployment script sets differ')
    records = []
    for name in scripts:
        if name not in mapped or digest(deployed[name]) != digest(mapped[name]):
            raise ValueError(f'JavaScript bytes differ: {name}')
        if name + '.map' not in mapped:
            records.append({'asset': name, 'sha256': digest(deployed[name]), 'map_sha256': None})
            continue
        map_path = mapped[name + '.map']
        data = json.loads(map_path.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or data.get('version') != 3 or not data.get('sources') or not data.get('mappings'):
            raise ValueError(f'invalid or empty source map: {name}')
        records.append({'asset': name, 'sha256': digest(deployed[name]), 'map_sha256': digest(map_path)})
    return records


def main():
    """Validate two supplied builds and print a hash-only manifest without source or credentials."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('deployment', type=Path)
    parser.add_argument('private_build', type=Path)
    parser.add_argument('--repository', type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    try:
        records = verify(args.deployment, args.private_build, args.repository)
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        parser.exit(1, f'Verification failed: {error}\n')
    print(json.dumps({'assets': records}, indent=2))


if __name__ == '__main__':
    main()
