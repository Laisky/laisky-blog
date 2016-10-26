import datetime

import tornado

from .base import BaseHandler
from gargantua.settings import OK, ERROR
from gargantua.utils import debug_wrapper, validate_passwd, generate_token, \
    validate_email, utcnow, logger, validate_token


class UserHandler(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url):
        logger.info('GET UserHandler {}'.format(url))

        router = {
            'login': self.login_page,
            'profile': self.profile,
            'api/user/ramjet-login': self.ramjet_login,
        }
        router.get(url, self.redirect_404)()

    @tornado.web.asynchronous
    def post(self, url):
        logger.info('POST UserHandler {}'.format(url))

        router = {
            'api/user/login': self.login_api,
        }
        router.get(url, self.redirect_404)()

    def login_page(self):
        logger.debug('login_page')
        self.render2('login/index.html')
        self.finish()

    def profile(self):
        self.render2('profile/index.html', current_app='profile')
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def ramjet_login(self):
        """
        GET 一个包含 source, id, username 的 token
        """
        print(generate_token({'source': 'twitter', 'username': 'Laisky', 'id': 1234567}))
        try:
            token = self.get_argument('token')
            d = validate_token(token)
        except Exception:
            logger.debug('ramjet_login validate error')
            self.http_400_bad_request(err='token validate error')
            self.finish()
            return

        # login from twitter
        sid = '{}.id'.format(d['source'])
        old_user = yield self.db.users.find_one({sid: d['id']})
        username = old_user and old_user['username'] or d['username']
        yield self.db.users.update(
            {sid: d['id']},
            {'$set': {'username': username,
                      sid: d['id'],
                      'last_update': utcnow()}},
            upsert=True
        )

        token = generate_token({'username': d['username']})
        self.set_cookie('token', token, expires_days=30)
        self.write_json(msg=OK)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def login_api(self):
        email = self.get_argument('email', strip=True)
        passwd = self.get_argument('password')
        is_keep_login = self.get_argument('is_keep_login', bool=True)
        logger.debug('login_api with email {}, passwd {}, is_keep_login {}'
                     .format(email, passwd, is_keep_login))

        if not validate_email(email):
            logger.debug("invalidate email: {}".format(email))
            self.write_json(msg="invalidate email", status=ERROR)
            self.finish()
            return

        user_docu = (yield self.db.users.find_one({'email': email}))
        if not user_docu:
            logger.debug('email not existed: {}'.format(email))
            self.http_400_bad_request(err='Wrong Account or Password')
            self.finish()
            return
        elif not validate_passwd(passwd, user_docu['password']):
            logger.debug('invalidate password: {}'.format(passwd))
            self.http_400_bad_request(err='Wrong Account or Password')
            self.finish()
            return

        uid = str(user_docu['_id'])
        dtoken = {'uid': uid, 'username': user_docu['username'], 'exp': utcnow() + datetime.timedelta(days=30)}
        token = generate_token(dtoken)

        yield self.db.users.update(
            {'_id': user_docu['_id']},
            {'$set': {'token': token, 'last_update': utcnow()}})

        expires_days = 30 if is_keep_login else None
        self.set_cookie('token', token, expires_days=expires_days)
        logger.debug('set cookies with uid {}, token {}, expires_days {}'.format(uid, token, expires_days))
        self.write_json(msg=OK)
        self.finish()
