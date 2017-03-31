import datetime

import tornado
from bson import ObjectId

from gargantua.utils import logger
from .base import BaseModel


class BaseBlogModel(BaseModel):

    __db__ = 'blog'


class ArticlesModel(BaseBlogModel):

    __collection__ = 'posts'

    @classmethod
    @tornado.gen.coroutine
    def update_posts_categories(cls, postid_category_map):
        """
        Args:
            postname_category_map (dict): {post_id: category_id}
        """
        logger.info('CategoriesModel.update_posts_categories')
        for post_id, cate in postid_category_map.items():
            r = yield cls.collection.update_one(
                {'_id': cls.oid(post_id)},
                {'$set': {'category': cls.oid(cate)}},
                upsert=False
            )
            logger.debug('update post %s category to %s for %s', post_id, cate, r.modified_count)


class CategoriesModel(BaseBlogModel):

    __collection__ = 'categories'


class ArticleBufferModel(BaseBlogModel):

    __collection__ = ''

    author = ObjectId
    post_id = ObjectId
    expired_at = datetime.datetime

    @classmethod
    @tornado.gen.coroutine
    def create_new_post_id(cls, author_id):
        pass
