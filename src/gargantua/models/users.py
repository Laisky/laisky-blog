#!/usr/bin/env python
# -*- coding: utf-8 -*-

from motorengine import Document, StringField, EmailField

from ..utils import validate_email
from ..utils.encryt import generate_passwd, validate_passwd


class Users(Document):
    meta = {'collection': 'users'}

    _password = StringField(db_field='password', required=True)
    _account = EmailField(db_field='account', required=True, unique=True)
    _email = EmailField(db_field='email')
    username = StringField(unique=True)
    level = StringField(required=True, default='reader')

    @property
    def password(self):
        return self._password
    @password.setter
    def password(self, value):
        self._password = generate_passwd(value)

    @property
    def email(self):
        return self._email
    @email.setter
    def email(self, value):
        # assert validate_email(value)
        self._email = value

    @property
    def account(self):
        return self._account
    @account.setter
    def account(self, value):
        # assert validate_email(value)
        self._account = value

    def authenticate(self, passwd):
        return validate_passwd(passwd, self._password)
