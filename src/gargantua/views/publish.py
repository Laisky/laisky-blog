#!/usr/bin/env python
# -*- coding: utf-8 -*-
import logging
import urllib
import datetime

import tornado

from .base import BaseHandler
from ..utils import debug_wrapper
from ..const import LOG_NAME, ERROR


log = logging.getLogger(LOG_NAME)


class PublishHandler(BaseHandler):
    """APIs about posts"""

    @tornado.web.authenticated
    def get(self):
        log.info('GET PublishHandler')

        self.render2('publish/index.html')
        self.finish()

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @tornado.gen.coroutine
    @debug_wrapper
    def post(self):
        log.info('POST PublishHandler')
        post_title = self.get_argument('postTitle', strip=True)
        post_name = self.get_argument('postName', strip=True)
        post_name = urllib.parse.quote(post_name)
        post_content = self.get_argument('postContent')
        post_type = self.get_argument('postType', default='text')
        log.debug('POST PublishHandler for post_title {}, post_name {}, '
                  'post_content {}, post_type {}'
                  .format(post_title, post_name, post_content, post_type))

        # check existed
        docu = yield self.db.posts.find_one({'post_name': post_name})
        if docu:
            log.debug('post name existed!')
            self.write_json(msg='post name existed!!!', status=ERROR)
            self.finish()
            return

        docu = {
            'post_author': self.current_user['_id'],
            'post_modified_gmt': datetime.datetime.utcnow(),
            'post_status': 'publish',
            'comment_status': 'open',
            'post_title': post_title,
            'post_name': post_name,
            'post_content': post_content,
            'post_type': post_type,
        }
        yield self.db.posts.update(
            {'post_name': post_name},
            {'$set': docu},
            upsert=True
        )

        self.write_json()
        self.finish()
