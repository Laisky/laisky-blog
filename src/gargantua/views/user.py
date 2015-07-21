import datetime
import logging

import tornado

from .base import BaseHandler
from ..const import LOG_NAME, OK, ERROR
from ..utils import (
    debug_wrapper, validate_passwd, generate_token,
    validate_email, utcnow
)


log = logging.getLogger(LOG_NAME)


class UserHandler(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url):
        log.info('GET UserHandler {}'.format(url))

        router = {
            'login': self.login_page,
            'profile': self.profile,
        }
        router.get(url, self.redirect_404)()

    @tornado.web.asynchronous
    def post(self, url):
        log.info('POST UserHandler {}'.format(url))

        router = {
            'api/user/login': self.login_api,
        }
        router.get(url, self.redirect_404)()

    def login_page(self):
        log.debug('login_page')
        self.render2('login/index.html')
        self.finish()

    def profile(self):
        self.render2('profile/index.html', current_app='profile')
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def login_api(self):

        email = self.get_argument('email', strip=True)
        passwd = self.get_argument('password')
        is_keep_login = self.get_argument('is_keep_login', bool=True)
        log.debug('login_api with email {}, passwd {}, is_keep_login {}'
                  .format(email, passwd, is_keep_login))

        if not validate_email(email):
            log.debug("invalidate email: {}".format(email))
            self.write_json(msg="invalidate email", status=ERROR)
            self.finish()
            return

        user_docu = (yield self.db.users.find_one({'email': email}))
        if not user_docu:
            log.debug('email not existed: {}'.format(email))
            self.write_json(msg='Wrong Account or Password', status=ERROR)
            self.finish()
            return
        elif not validate_passwd(passwd, user_docu['password']):
            log.debug('invalidate password: {}'.format(passwd))
            self.write_json(msg='Wrong Account or Password', status=ERROR)
            self.finish()
            return

        uid = str(user_docu['_id'])
        jwt = {'uid': uid, 'exp': utcnow() + datetime.timedelta(days=30)}
        token = generate_token(jwt, user_docu['password'])

        yield self.db.users.update(
            {'_id': user_docu['_id']},
            {'$set': {'token': token, 'last_update': utcnow()}})

        expires_days = 30 if is_keep_login else None
        self.set_secure_cookie('uid', uid, expires_days=expires_days)
        self.set_secure_cookie('token', token, expires_days=expires_days)
        log.debug('set cookies with uid {}, token {}, expires_days {}'.format(uid, token, expires_days))
        self.write_json(msg=OK)
        self.finish()
