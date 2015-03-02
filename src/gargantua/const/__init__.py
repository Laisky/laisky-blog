#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os


# server
LISTEN_PORT = 27850

# common
CWD = os.dirname(__file__)
LOG_NAME = 'gargantua'
LOG_PATH = '/var/log/gargantua'

# web signal
OK = 0
ERROR = 1

# db
DB_HOST = 'localhost'
DB_PORT = 27017
DB_NAME = 'blog'


# test
DB_HOST = 'blog.laisky.com'
# DB_NAME = 'test'
