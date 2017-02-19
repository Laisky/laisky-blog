import re
import os
from shutil import copy2


root_path = '/srv/gargantua/uploads/'
filename_regex = re.compile('^(.*)\-\d+x\d+\.(jpg|jpeg|png|gif)$', flags=re.I)


def handle_files(root, f):
    re_g = filename_regex.match(f)
    if not re_g:
        return

    fname, fext = re_g.groups()
    old_f = os.path.join(root, f)
    new_f = '{}/{}.{}'.format(root, fname, fext)
    if not os.path.isfile(new_f):
        copy2(old_f, new_f)
        print('create {}'.format(new_f))


for root, dirs, files in os.walk(root_path):
    for f in files:
        handle_files(root, f)
