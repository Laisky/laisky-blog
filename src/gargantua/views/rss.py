import tornado
import pymongo

from ..utils import debug_wrapper, unquote_fr_mongo
from .base import BaseHandler


class RssHandler(BaseHandler):

    @tornado.gen.coroutine
    @debug_wrapper
    def get(self):
        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)]) \

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            if docu.get('post_password'):
                continue

            posts.append(unquote_fr_mongo(docu))

        self.render_post('rss.html', posts=posts)
        self.finish()
