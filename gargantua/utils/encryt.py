#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jwt
import bcrypt

from gargantua.settings import SECRET_KEY


def generate_passwd(passwd):
    return bcrypt.hashpw(passwd.encode('utf8'), bcrypt.gensalt(len(passwd))).decode('utf8')


def validate_passwd(passwd, hashed):
    return bcrypt.hashpw(passwd.encode('utf8'), hashed.encode('utf8')) == hashed.encode('utf8')


def generate_token(json_, secret=SECRET_KEY):
    return jwt.encode(json_, secret, algorithm='HS512').decode()


def validate_token(token, secret=SECRET_KEY):
    return decode_token(token, secret=secret) is not None


def decode_token(token, secret=SECRET_KEY):
    """
    JWT is dangerous: https://paragonie.com/blog/2017/03/jwt-json-web-tokens-is-bad-standard-that-everyone-should-avoid
    """
    try:
        return jwt.decode(token, secret, algorithms=['HS512'])
    except (jwt.InvalidAlgorithmError, jwt.DecodeError):
        raise
