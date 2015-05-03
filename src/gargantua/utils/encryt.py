#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jwt
import bcrypt


def generate_passwd(passpw):
    return bcrypt.hashpw(passpw, bcrypt.gensalt())


def validate_passwd(passpw, hashed):
    return bcrypt.hashpw(passpw, hashed) == hashed


def generate_token(json_, secret):
    return jwt.encode(json_, secret, algorithm='HS512').decode()


def validate_token(token, secret):
    return jwt.decode(token, secret, verify=True)
