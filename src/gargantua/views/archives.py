#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging

import pymongo
import tornado
import tornado.httpclient
import html2text
from bson import ObjectId

from .base import BaseHandler
from ..utils import (
    debug_wrapper, unquote_fr_mongo, generate_keyword_search, parse_search_resp
)
from ..const import LOG_NAME, N_POST_PER_PAGE, ES_HOST, ES_PORT


log = logging.getLogger(LOG_NAME)


class PostsHandler(BaseHandler):
    """APIs about posts"""

    @tornado.web.asynchronous
    def get(self, url=None):
        log.info('GET PostsHandler {}'.format(url))

        router = {
            'archives': self.get_post_by_page,
            'search': self.get_post_by_keyword,
            'api/posts/get-lastest-posts-by-name': self.get_lastest_posts_by_name,
            'api/posts/get-post-by-id': self.get_post_by_id,
            'api/posts/get-post-by-page': self.get_post_by_page,
        }
        router.get(url, self.redirect_404)()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_keyword(self):
        log.info('GET get_post_by_keyword')

        keyword = self.get_argument('keyword', strip=True)
        log.debug('GET get_post_by_keyword for keyword {}'.format(keyword))

        url = 'http://{}:{}/posts/post/_search'.format(ES_HOST, ES_PORT)
        body = generate_keyword_search(keyword=keyword)
        http = tornado.httpclient.AsyncHTTPClient()
        resp = (yield http.fetch(url, body=body, method='POST')).body.decode()
        log.debug('get resp from elasticsearch: {}'.format(resp))
        posts = parse_search_resp(resp)
        for docu in posts:
            docu['post_content'] = self.shortly_content(docu['post_content'], length=200)

        self.render_post('search/index.html', posts=posts)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_page(self):
        log.info('GET get_post_by_page')

        page = int(self.get_argument('page', strip=True, default=1))
        is_full = self.get_argument('is_full', strip=True, default=False)
        log.debug('get_post_by_page for page {}'.format(page))

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
                    docu['post_content'] = content[: 1000]

            posts.append(docu)

        self.render_post('archives/index.html',
                         posts=posts, current_page=page)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_lastest_posts_by_name(self):
        since_name = self.get_argument('since_name', strip=True)
        is_full = self.get_argument('is_full', strip=True, default=False)
        log.debug('get_lastest_posts for since_name {}'
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
        is_full = self.get_argument('is_full', strip=True, default=False)
        _id = self.get_argument('id', strip=True)
        log.debug('get_post_by_id for _id {}, is_full {}'.format(_id, is_full))

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
