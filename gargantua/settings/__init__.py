#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from .settings_demo import *  # for test and default
try:
    from .settings import *
except ImportError:
    pass
