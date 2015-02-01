#!/usr/bin/env python
# -*- coding: utf-8 -*-

import bcrypt


def generate_passwd(passpw):
    return bcrypt.hashpw(passpw.encode('utf-8'), bcrypt.gensalt())


def validate_passwd(passpw, hashed):
    return bcrypt.hashpw(passpw.encode('utf-8'), hashed) == hashed
