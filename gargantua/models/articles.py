import datetime

import tornado
from bson import ObjectId

from .base import BaseBlogModel


class ArticlesModel(BaseBlogModel):

    __collection__ = 'posts'

    @tornado.gen.croutine
    def create_new_post_id(self):
        pass

    @classmethod
    @tornado.gen.coroutine
    def load_post_by_name(self, name):



class ArticleBufferModel(BaseBlogModel):

    __collection__ = ''

    author = ObjectId
    post_id = ObjectId
    expired_at = datetime.datetime

    @classmethod
    @tornado.gen.coroutine
    def create_new_post_id(cls, author_id):
        pass
