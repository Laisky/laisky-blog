#!/usr/bin/env python

try:
    import setuptools
    from setuptools import setup
except ImportError:
    setuptools = None
    from distutils.core import setup
from pip.req import parse_requirements
from pip.download import PipSession

import gargantua


requires = [str(i.req) for i in parse_requirements('requirements.txt',
                                                   session=PipSession())
            if i.req is not None]
version = gargantua.__version__
kwargs = {}
with open('README.md', 'r') as f:
    kwargs['long_description'] = f.read()

setup(
    name='gargantua',
    version=version,
    packages=['gargantua'],
    include_package_data=True,
    install_requires=requires,
    entry_points="""\
        [console_scripts]
        run_gargantua=gargantua.__main__:main
    """,
    author='Laisky',
    author_email='ppcelery@gmail.com',
    description='Laisky\'s blog project',
    url='http://blog.laisky.com',
    license='MIT License',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Development Status :: 4 - Beta',
        'Topic :: Software Development :: Libraries',
        'Environment :: Web Environment',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.4',
    ],
    keywords=[
        'setup',
        'distutils',
        'tornado',
    ],
    **kwargs
)
