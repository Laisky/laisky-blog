#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import json
import traceback

import jwt
from bson import ObjectId

from gargantua.utils import validate_token
from gargantua.const import LOG_NAME, OK


log = logging.getLogger(LOG_NAME)
__all__ = [
    'debug_wrapper', 'DbHandlerMixin', 'WebHandlerMixin', 'AuthHandlerMixin'
]


def debug_wrapper(func):
    def wrapper(*args, **kw):
        log.debug('debug_wrapper for args {}, kw {}'.format(args, kw))
        try:
            yield from func(*args, **kw)
        except Exception:
            log.error(traceback.format_exc())
            raise
    return wrapper


class DbHandlerMixin():

    @property
    def db(self):
        return self.application.db

    @property
    def mongo_db(self):
        return self.application.mongo_db


class WebHandlerMixin():

    @property
    def ip(self):
        return self.request.headers.get('X-Real-IP', self.request.remote_ip)

    def write_json(self, *, status=OK, msg='', data={}):
        j = json.dumps({'status': status, 'msg': msg, 'data': data})
        log.debug('<< {}'.format(j))
        self.write(j)

    def get_argument(self, arg_name, bool=False, *args, **kw):
        val = super().get_argument(arg_name, *args, **kw)
        if bool:
            return False if val in ('false', 'False', False, 0, None) else True
        else:
            return val

    @property
    def is_ajax(self):
        return self.request.headers.get('X-Requested-With') == "XMLHttpRequest"

    @property
    def is_https(self):
        return self.request.headers.get('X-Scheme') == "https"

    def redirect_404(self):
        self.redirect('/404.html')


class AuthHandlerMixin():

    def get_current_user(self):
        log.debug('get_current_user')

        try:
            cli_uid = self.get_secure_cookie('uid')
            cli_token = self.get_secure_cookie('token')

            cli_uid = cli_uid and cli_uid.decode()
            cli_token = cli_token and cli_token.decode()

            if not cli_uid or not cli_token:
                return

            user_docu = self.mongo_db.users.find_one(
                {'_id': ObjectId(cli_uid)}
            )
            assert cli_token == user_docu['token']

            token_docu = validate_token(cli_token, user_docu['password'])
            assert token_docu['uid'] == cli_uid

        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as err:
            log.debug('token validate error: {}'.format(err))
        except AttributeError as err:
            log.debug('get_current_user error: {}'.format(err))
        except Exception:
            err = traceback.format_exc()
            log.exception('get_current_user error: {}'.format(err))
        else:
            log.debug("authenticated user")
            return user_docu
