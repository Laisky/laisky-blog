#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import json
import traceback
import logging
from math import ceil

import jwt
import tornado
from bson import ObjectId
from raven.contrib.tornado import SentryMixin

from ..const import OK, LOG_NAME, N_POST_PER_PAGE
from ..utils import TemplateRendering, validate_token


log = logging.getLogger(LOG_NAME)
__all__ = ['BaseHandler']


class BaseHandler(tornado.web.RequestHandler, TemplateRendering, SentryMixin):

    def get(self, url=None):
        url = url.strip(' /')
        super().get(url)

    @property
    def db(self):
        return self.application.db

    @property
    def mongo_db(self):
        return self.application.mongo_db

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

        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, AssertionError) as err:
            log.debug('token validate error: {}'.format(err))
        except AttributeError as err:
            log.debug('get_current_user error: {}'.format(err))
        except Exception:
            err = traceback.format_exc()
            log.exception('get_current_user error: {}'.format(err))
        else:
            log.debug("authenticated user")
            return user_docu

    def redirect_404(self):
        self.redirect('/404.html')

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

        kwargs.update({
            'settings': self.settings,
            'static_url': static_url,
            'request': self.request,
            'xsrf_token': self.xsrf_token,
            'xsrf_form_html': self.xsrf_form_html,
            'max': max,
            'min': min,
            'is_ajax': self.is_ajax,
            'is_https': self.is_https,
            'current_user': self.get_current_user(),
        })
        return super().render_template(template_name, **kwargs)

    @tornado.gen.coroutine
    def prepare(self):
        super().prepare()
        cursor = self.db.posts.find()
        self.post_count = yield cursor.count()
        self.max_page = ceil(self.post_count / N_POST_PER_PAGE)
        log.debug('prepare for post_count {}, max_page {}'
                  .format(self.post_count, self.max_page))

    def render_post(self, template_name, **kwargs):
        kwargs.update({
            'max_page': self.max_page,
        })
        self.render2(template_name, **kwargs)
