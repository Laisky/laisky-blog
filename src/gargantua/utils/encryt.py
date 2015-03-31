#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import hashlib


def generate_passwd(passwd, salt=None):
    salt = salt or os.urandom(256)
    return hashlib.sha256(salt + passwd.encode()).hexdigest().encode() + salt


def validat_passwd(passwd, hashed):
    salt = hashed[-256:]
    return generate_passwd(passwd, salt) == hashed
