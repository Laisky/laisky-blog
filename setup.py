from setuptools import setup, find_packages
from pip.req import parse_requirements
from pip.download import PipSession


requires = [str(i.req) for i in parse_requirements('requirements.txt',
                                                   session=PipSession())
            if i.req is not None]

setup(name='gargantua',
      version='1.7.3',
      packages=find_packages('src'),
      package_dir={'': 'src'},
      include_package_data=True,
      install_requires=requires,
      entry_points="""\
      [console_scripts]
      run_gargantua=gargantua.__main__:main
      """)
