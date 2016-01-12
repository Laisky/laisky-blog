#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""View about any articles.
"""

import urllib

import pymongo
import tornado
import tornado.httpclient
import html2text
from bson import ObjectId

from .base import BaseHandler
from ..utils import debug_wrapper, unquote_fr_mongo, logger
from ..const import N_POST_PER_PAGE
from ..models import ArticlesModel


class PostsHandler(BaseHandler):

    """APIs about posts"""

    @tornado.web.asynchronous
    def get(self, url=None, *args, **kw):
        logger.info('GET PostsHandler {}'.format(url))

        router = {
            'archives': self.get_post_by_page,       # 按页数获取文章
            'search': self.get_post_by_keyword,      # 按关键词搜索
            'publish': self.get_new_post,            # 发表新文章
            'p': self.get_post_by_name,              # 单篇文章的页面
            'api/posts/get-lastest-posts-by-name': self.get_lastest_posts_by_name,
            'api/posts/get-post-by-id': self.get_post_by_id,
            'api/posts/get-post-by-page': self.get_post_by_page,
        }
        router.get(url, self.redirect_404)(*args, **kw)

    @tornado.web.authenticated
    def post(self):
        """Post new article
        """
        pass

    @tornado.web.authenticated
    def patch(self):
        """Update existed article
        """
        pass

    @tornado.web.authenticated
    def delete(self):
        """Delete existed article
        """
        pass

    def parse_post_name(self, name):
        return urllib.parse.quote(name).lower()

    def get_cookie_name(self, post_name):
        return 'post.auth.{}'.format(post_name)

    @tornado.web.authenticated
    def get_new_post(self):
        logger.info('get_new_post')
        self.render2('archives/publish.html')
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_name(self, name):
        logger.info('get_post_by_name for name {}'.format(name))

        name = self.parse_post_name(name)
        post = yield ArticlesModel.get({'post_name': name})
        if not post:
            self.redirect_404()
            return

        if post.get('post_password'):
            cookie_name = self.get_cookie_name(name)
            cookie = self.get_secure_cookie(cookie_name)
            logger.debug('get cookie {}'.format(cookie))
            if not cookie or cookie.decode() != post['post_password']:
                self.render2('archives/ajax/auth.html', post_name=post['post_name'])
                raise self.http_401_unauthorized('Need password.')

        post['post_type'] = post.get('post_type', 'text')
        self.render2('archives/article.html', post=post)
        self.finish()

    def get_post_by_keyword(self):
        logger.info('GET get_post_by_keyword')

        keyword = self.get_argument('keyword', strip=True)
        logger.debug('GET get_post_by_keyword for keyword {}'.format(keyword))

        q = 'https://cse.google.com/cse/publicurl?cx=004733495569415005684:-c6y46kjqva&q={keyword}'
        self.redirect(q.format(keyword=keyword, permanent=True))
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_page(self):
        logger.info('GET get_post_by_page')

        try:
            page = int(self.get_argument('page', strip=True, default=1))
            is_full = self.get_argument('is_full', strip=True, default=False)
        except ValueError:
            pass
        else:
            logger.debug('get_post_by_page for page {}'.format(page))

        skip = (page - 1) * N_POST_PER_PAGE
        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)]) \
            .limit(N_POST_PER_PAGE) \
            .skip(skip)
        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            # if docu.get('post_password'):
            #     continue

            docu = unquote_fr_mongo(docu)
            if not is_full:
                if docu.get('post_password'):
                    docu['post_content'] = """
                        <div class="preview">
                            <span class="glyphicon glyphicon-lock" aria-hidden="true"></span>
                        </div>
                    """
                else:
                    content = html2text.html2text(docu['post_content'])
                    docu['post_content'] = content[: 500]

            posts.append(docu)

        # tags
        tags = (yield self.db.statistics.find_one(
            {'types': 'keyword'},
            {'keywords': 1}
        ))['keywords']

        self.render_post('archives/archives.html',
                         posts=posts, current_page=page, tags=tags)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_lastest_posts_by_name(self):
        try:
            since_name = self.get_argument('since_name', strip=True)
            is_full = self.get_argument('is_full', strip=True, default=False)
        except ValueError:
            pass
        else:
            logger.debug('get_lastest_posts for since_name {}'
                         .format(since_name))

        n = N_POST_PER_PAGE
        since_id = (yield
                    self.db.posts.find_one({'post_name': since_name}))['_id']
        cursor = self.db.posts.find({'_id': {'$lt': since_id}})
        cursor.sort([('_id', pymongo.DESCENDING)]).limit(n)
        posts = []
        for docu in (yield cursor.to_list(length=n)):
            if docu.get('post_password'):
                continue

            docu = unquote_fr_mongo(docu)
            if not is_full:
                docu['post_content'] = self.shortly_content(docu['post_content'])

            posts.append(docu)

        _posts = self.render_template('widgets/post.html', posts=posts)
        self.write_json(data=_posts)
        self.finish()

    def shortly_content(self, content, length=1000):
        return html2text.html2text(content)[: length]

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_id(self):
        try:
            is_full = self.get_argument('is_full', strip=True, default=False)
            _id = self.get_argument('id', strip=True)
        except ValueError:
            pass
        else:
            logger.debug('get_post_by_id for _id {}, is_full {}'.format(_id, is_full))

        docu = yield self.db.posts.find_one({'_id': ObjectId(_id)})
        if docu:
            docu['post_created_gmt'] = \
                docu['_id'].generation_time.timestamp() * 1000
            docu['_id'] = str(docu['_id'])
            docu['post_modified_gmt'] = \
                docu['post_modified_gmt'].timestamp() * 1000
            if not is_full:
                docu['post_content'] = docu['post_content'][: 1000]

        self.write_json(data=docu)
        self.finish()
