#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jwt
import bcrypt

from gargantua.settings import SECRET_KEY


def generate_passwd(passwd):
    return bcrypt.hashpw(passwd, bcrypt.gensalt())


def validate_passwd(passwd, hashed):
    return bcrypt.hashpw(passwd, hashed) == hashed


def generate_token(json_, secret=SECRET_KEY):
    return jwt.encode(json_, secret, algorithm='HS512').decode()


def validate_token(token, secret=SECRET_KEY):
    return jwt.decode(token, secret, verify=True)
