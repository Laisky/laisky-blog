#!/usr/bin/env python3
"""Verify an offline hidden-map build against the exact deployable assets."""

import argparse
import hashlib
import json
import re
from pathlib import Path


# These exact Vite 8 outputs were inspected; no mapping is claimed for them.
QUALIFIED_MAPLESS = {
    'assets/architecture-WOLXFQ4H-D7HsUAZc.js': '7edfb52b21f6fc462ea494823f885b7417dd8ad0afe297032d9fe69782318b10',
    'assets/cynefin-EF2NZ3EQ-BP2Ougdy.js': '7ecdf46b944cf551ed5d4e977a31a6b5b1ac4aa598aab3e66d9e96dd425b1201',
    'assets/eventmodeling-K75KTNOO-BU5zGjO0.js': '31dea5e05ef6922ace4833908351abbe565f510d5dbf42233764e985046005ca',
    'assets/flowDiagram-MALGAFMO-BY4DHO-C.js': '098c2b7efc8cf8ef87a31a4629902980d86790b3dda5a4b5915e3bbe121d8e39',
    'assets/gitGraph-VSP46ZUC-DKdETGXB.js': 'e03ee50d74cf9304600b57e790ef9244749c0eb22a9b715c623bf45439ef4b01',
    'assets/info-OHQRW6UA-S2R6wqej.js': '36c7e9dee2047fcf05a4a18ffeb5ecbae21753aec83024194a1f19856b656222',
    'assets/packet-JDAUHWVQ-J2ZFyUqF.js': '2e99b0410bbbc655ccf45ea163edfb9dfb8623f57c6768189d422b8e7c828158',
    'assets/pie-XZMESJXO-0Q1OIp7u.js': 'ed0a1a8d07f13737f6d86e3407e0f0991d28e1927cf5d06f5ab662e75d04d134',
    'assets/radar-ABXABTNO-rfFlWtEE.js': 'e283deac02d4a40b80cd03cb974640c2c12100f0f70a80283f2a784878ae9589',
    'assets/railroad-I3PHUGI6-Cld_mlXc.js': '4b507f958c0e9f1dba94e20a61f214fcb1f140879b68634af3c56fb016909e1e',
    'assets/railroad-abnf-LNEFI6M7-PiA8-rjU.js': '3dad787a987076c68afb89230b99a72ea7b704943644cbb0a02dbd9412cec777',
    'assets/railroad-ebnf-DWYD2UWJ-FgG6GFgs.js': '6594f9366981338f1fb7aaffd2dbcb4cb2309c39a87bddab0c1a845968873d3d',
    'assets/railroad-peg-JR7BVNR7-DzmIgNnQ.js': '0372f054b8148bf0afe14bb319ee5c501ccd06d1a4bf52d42cf486958c06c738',
    'assets/rolldown-runtime-BCiCTKAo.js': 'f85e715d54a11fa37b7774ad77b536896ed01bfdfc98f485b678c81859fc8e2e',
    'assets/treeView-D4JQ5SDB-DKJFR-wZ.js': '3b5816123415bbbcc6e5658b738b3203aa8ac50c34e10257bfa1762bc3b8ad99',
    'assets/treemap-SAJKECNS-D4cId61S.js': '03d6ee15f24468c96aeb8b045118c63b8b5a2767462144f59d704bf4bb1d08a3',
    'assets/wardley-7MLQ67FV-CdiCE0du.js': 'f9c6f641f526a819dfc854488da4081d7f56654fd6d91150008ed9fa6bd1f6ba',
}


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


def verify(public, private, repository, qualified_mapless=None):
    """Return asset and map hashes only when both build trees meet isolation and identity checks."""
    public, private, repository = (p.resolve(strict=True) for p in (public, private, repository))
    if not public.is_dir() or not private.is_dir() or not repository.is_dir():
        raise ValueError('all inputs must be directories')
    if (private.is_relative_to(repository) or repository.is_relative_to(private)
            or public.is_relative_to(private) or private.is_relative_to(public)):
        raise ValueError('private build must be outside the repository and deployment tree')
    if qualified_mapless is None:
        qualified_mapless = QUALIFIED_MAPLESS
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
            raise ValueError('JavaScript bytes differ')
        path_hash = hashlib.sha256(name.encode('utf-8')).hexdigest()
        if name + '.map' not in mapped:
            if qualified_mapless.get(name) != digest(deployed[name]):
                raise ValueError('unqualified mapless script')
            records.append({'asset_path_sha256': path_hash, 'sha256': digest(deployed[name]), 'map_sha256': None})
            continue
        map_path = mapped[name + '.map']
        data = json.loads(map_path.read_text(encoding='utf-8'))
        if (not isinstance(data, dict) or data.get('version') != 3
                or not isinstance(data.get('sources'), list) or not data['sources']
                or not all(isinstance(source, str) and source for source in data['sources'])
                or not isinstance(data.get('mappings'), str) or not data['mappings']
                or not re.fullmatch(r'[A-Za-z0-9+/;,]+', data['mappings'])
                or ('sourcesContent' in data and (not isinstance(data['sourcesContent'], list)
                    or len(data['sourcesContent']) != len(data['sources'])
                    or any(item is not None and not isinstance(item, str) for item in data['sourcesContent'])))):
            raise ValueError('invalid or empty source map')
        records.append({'asset_path_sha256': path_hash, 'sha256': digest(deployed[name]), 'map_sha256': digest(map_path)})
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
        # Filesystem and JSON exceptions can contain private paths or source-map contents.
        if isinstance(error, (OSError, UnicodeError, json.JSONDecodeError)):
            parser.exit(1, 'Verification failed: unable to read a valid build tree or map\n')
        parser.exit(1, f'Verification failed: {error}\n')
    print(json.dumps({'assets': records}, indent=2))


if __name__ == '__main__':
    main()
