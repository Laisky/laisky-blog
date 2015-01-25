#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import inspect

import gargantua


# server
LISTEN_PORT = 27850

# common
CWD = os.path.dirname(inspect.getfile(gargantua))
LOG_PATH = '/var/log/gargantua'

# web signal
OK = 0
ERROR = 1

# db
DB_HOST = 'localhost'
DB_PORT = 27017
DB_NAME = 'blog'
