import datetime

import tornado

from .base import BaseHandler
from gargantua.settings import OK, ERROR
from gargantua.utils import debug_wrapper, validate_passwd, generate_token, \
    validate_email, utcnow, logger, validate_token


class UserHandler(BaseHandler):

    @tornado.web.asynchronous
    def get(self, url):
        logger.info('GET UserHandler %s', url)

        router = {
            'login': self.login_page,
            'profile': self.profile,
            'api/user/ramjet-login': self.ramjet_login,
        }
        router.get(url, self.redirect_404)()

    @tornado.web.asynchronous
    def post(self, url):
        logger.info('POST UserHandler %s', url)

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
        try:
            token = self.get_argument('token')
            d = validate_token(token)
        except Exception:
            logger.debug('ramjet_login validate error')
            self.http_400_bad_request(err='token validate error')
            self.finish()
            return

        # login from twitter
        sid_str = '{}.id'.format(d['source'])  # like "twitter.id"
        old_user = yield self.db.users.find_one({sid_str: d['id']})
        username = old_user['username'] if old_user else d['username']
        yield self.db.users.update(
            {sid_str: d['id']},
            {'$set': {'username': username,
                      sid_str: d['id'],
                      'last_update': utcnow()}},
            upsert=True
        )
        user_docu = yield self.db.users.find_one({sid_str: d['id']})

        token = generate_token({'username': d['username'], 'uid': user_docu['_id']})
        self.set_cookie('token', token, expires_days=30)
        self.write_json(msg=OK)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def login_api(self):
        email = self.get_argument('email', strip=True)
        passwd = self.get_argument('password')
        is_keep_login = self.get_argument('is_keep_login', bool=True)
        logger.debug('login_api with email %s, passwd %s, is_keep_login %s', email, passwd, is_keep_login)

        if not validate_email(email):
            logger.debug("invalidate email: %s", email)
            self.write_json(msg="invalidate email", status=ERROR)
            self.finish()
            return

        user_docu = (yield self.db.users.find_one({'email': email}))
        if not user_docu:
            logger.debug('email not existed: %s', email)
            self.http_400_bad_request(err='Wrong Account or Password')
            self.finish()
            return
        elif not validate_passwd(passwd, user_docu['password']):
            logger.debug('invalidate password: %s', passwd)
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
        logger.debug('set cookies with uid %s, token %s, expires_days %s', uid, token, expires_days)
        self.write_json(msg=OK)
        self.finish()
