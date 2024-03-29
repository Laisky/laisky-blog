#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import logging
import os
import re
import traceback
from collections import namedtuple
from functools import wraps

import jwt
from gargantua.settings import LOG_NAME, OK
from gargantua.utils import decode_token, validate_token

import tornado

from .jinja import TemplateRendering

logger = logging.getLogger(LOG_NAME)


def debug_wrapper(func):
    @wraps(func)
    def wrapper(*args, **kw):
        try:
            r = func(*args, **kw)
            if r:
                yield from r
        except Exception as err:
            if isinstance(err, tornado.gen.Return):
                raise

            logger.debug('debug_wrapper for args {}, kw {}'.format(args, kw))
            self = args[0]
            if getattr(self, 'request', None):
                err_msg = {
                    'uri': str(self.request.uri),
                    'remote_ip': self.request.remote_ip,
                    'version': str(self.request.version),
                    'headers': dict(self.request.headers),
                    'cookies': str(self.request.cookies),
                }
            else:
                err_msg = 'without self.request'

            logger.error('{}\n-----\n{}'.format(
                traceback.format_exc(),
                json.dumps(err_msg, indent=4, sort_keys=True),
            ))
            if getattr(self, 'finish', None):
                self._finished or self.finish()

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
        logger.debug('<< {}'.format(j[: 50]))
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


class RFCMixin():

    """http://www.ietf.org/rfc/rfc2616.txt"""

    Accept = namedtuple('accept', ['name', 'quality', 'level'])
    ACC_NAME_REGX = re.compile('([a-z\*]+\/[a-z\*\-]+)')
    ACC_Q_REGX = re.compile('q=([0-9.]+)')
    ACC_LEVEL_REGX = re.compile('level=([0-9.]+)')

    def _parse_accept(self, accept):
        def extract(regx, s):
            return regx.findall(s) or ['0']

        t = extract(self.ACC_NAME_REGX, accept)[0]
        q = float(extract(self.ACC_Q_REGX, accept)[0])
        lev = float(extract(self.ACC_LEVEL_REGX, accept)[0])
        return self.Accept(name=t, quality=q, level=lev)

    @property
    def accept(self):
        # IEFT RFC-2616 p.100
        raw_accepts = self.request.headers.get('Accept', '').split(',')
        accepts = [self._parse_accept(a) for a in raw_accepts]
        parsed_accepts = sorted(accepts, key=lambda ac: ac.quality, reverse=True)
        logger.debug('Requests Accepts: {}'.format(parsed_accepts))
        return parsed_accepts


class AuthHandlerMixin():

    def get_current_user(self):
        try:
            cli_token = self.request.headers.get('Authorization', "")
            logger.debug(f'get_current_user with {cli_token}')
            if not cli_token:
                logger.debug('token is missed')
                return

            user_docu = decode_token(cli_token)
            # uid = decode_token(cli_token)['sub']
            # user_docu = self.mongo_db.users.find_one(
            #     {'_id': ObjectId(uid)}
            # )
            # assert user_docu, 'user not existed'
            # assert cli_token == user_docu['token'], 'token incorrect'
            # validate_token(cli_token)
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError,
                AssertionError):
            logger.exception('token validate error')
            self.clear_cookie('token')
        except AttributeError:
            logger.exception('get_current_user error')
            self.clear_cookie('token')
        except Exception:
            logger.exception('get_current_user error')
        else:
            logger.debug("authenticated user %s", user_docu['username'])
            return user_docu


class JinjaMixin(TemplateRendering):

    def render2(self, template_name, **kwargs):
        """
        This is for making some extra context variables available to
        the template
        """
        content = self.render_template(template_name, **kwargs)
        self.write(content)

    def render_template(self, template_name, **kwargs):
        def static_url(path):
            prefix = self.settings.get('static_url_prefix')
            return os.path.join(prefix, path)

        _kwargs = ({
            'settings': self.settings,
            'static_url': static_url,
            'reverse_url': self.reverse_url,
            'request': self.request,
            'xsrf_token': self.xsrf_token,
            'xsrf_form_html': self.xsrf_form_html,
            'max': max,
            'min': min,
            'is_ajax': self.is_ajax,
            'is_https': self.is_https,
            # 'current_user': self.current_user,
            'current_app': 'blog',
        })
        _kwargs.update(kwargs)
        return super().render_template(template_name, **_kwargs)


class HttpErrorMixin():

    """
    Raise Http Error with status code

    err=Error message
    """

    def parse_err(self, err):
        if isinstance(err, BaseException):
            return ' '.join(str(_) for _ in err.args)
        else:
            return str(err)

    def http_400_bad_request(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(400)  # bug in write_error

        return self.write_error(status_code=400, **kwargs)

    def http_401_unauthorized(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(401)  # bug in write_error

        return self.write_error(status_code=401, **kwargs)

    def http_402_payment_required(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(402)  # bug in write_error

        return self.write_error(status_code=402, **kwargs)

    def http_403_forbidden(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(403)  # bug in write_error

        return self.write_error(status_code=403, **kwargs)

    def http_404_not_found(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(404)  # bug in write_error

        return self.write_error(status_code=404, **kwargs)

    def http_405_method_not_allowed(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(405)  # bug in write_error

        return self.write_error(status_code=405, **kwargs)

    def http_406_not_acceptable(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(406)  # bug in write_error

        return self.write_error(status_code=406, **kwargs)

    def http_407_proxy_authentication_required(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(407)  # bug in write_error

        return self.write_error(status_code=407, **kwargs)

    def http_408_request_timeout(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(408)  # bug in write_error

        return self.write_error(status_code=408, **kwargs)

    def http_409_conflict(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(409)  # bug in write_error

        return self.write_error(status_code=409, **kwargs)

    def http_410_gone(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(410)  # bug in write_error

        return self.write_error(status_code=410, **kwargs)

    def http_411_length_required(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(411)  # bug in write_error

        return self.write_error(status_code=411, **kwargs)

    def http_412_precondition_failed(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(412)  # bug in write_error

        return self.write_error(status_code=412, **kwargs)

    def http_413_request_entity_too_large(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(413)  # bug in write_error

        return self.write_error(status_code=413, **kwargs)

    def http_414_request_uri_too_long(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(414)  # bug in write_error

        return self.write_error(status_code=414, **kwargs)

    def http_415_unsupported_media_type(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(415)  # bug in write_error

        return self.write_error(status_code=415, **kwargs)

    def http_416_requested_range_not_satisfiable(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(416)  # bug in write_error

        return self.write_error(status_code=416, **kwargs)

    def http_417_expectation_failed(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(417)  # bug in write_error

        return self.write_error(status_code=417, **kwargs)

    def http_428_precondition_required(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(428)  # bug in write_error

        return self.write_error(status_code=428, **kwargs)

    def http_429_too_many_requests(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(429)  # bug in write_error

        return self.write_error(status_code=429, **kwargs)

    def http_431_request_header_fields_too_large(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(431)  # bug in write_error

        return self.write_error(status_code=431, **kwargs)

    def http_500_internal_server_error(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(500)  # bug in write_error

        return self.write_error(status_code=500, **kwargs)

    def http_501_not_implemented(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(501)  # bug in write_error

        return self.write_error(status_code=501, **kwargs)

    def http_502_bad_gateway(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(502)  # bug in write_error

        return self.write_error(status_code=502, **kwargs)

    def http_503_service_unavailable(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(503)  # bug in write_error

        return self.write_error(status_code=503, **kwargs)

    def http_504_gateway_timeout(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(504)  # bug in write_error

        return self.write_error(status_code=504, **kwargs)

    def http_505_http_version_not_supported(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(505)  # bug in write_error

        return self.write_error(status_code=505, **kwargs)

    def http_511_network_authentication_required(self, **kwargs):
        if 'err' in kwargs:
            err = kwargs.pop('err')
            self._reason = self.parse_err(err)
            self.set_status(511)  # bug in write_error

        return self.write_error(status_code=511, **kwargs)
