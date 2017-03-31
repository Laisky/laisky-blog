"""Constructors to make query to db"""
from abc import ABC, abstractclassmethod

import pymongo
from bson import ObjectId

from gargantua.utils import logger


class QueryMakerError(Exception):
    pass


class BaseMaker(ABC):

    @abstractclassmethod
    def update_query(cls, app, query, projection):
        return query, projection


class PostCategoiesFilterMaker(BaseMaker):
    """Posts' Categories filter"""

    @staticmethod
    def get_default_posts_projection():
        return {
            'post_author': 1,
            'post_content': 1,
            'link': 1,
            'post_id': 1,
            'post_name': 1,
            'post_status': 1,
            'post_title': 1,
            'post_type': 1,
            'post_menu': 1,
            'post_modified_gmt': 1,
            'post_created_at': 1,
        }

    @classmethod
    def update_query(cls, app, query, projection):
        projection = projection or cls.get_default_posts_projection()
        try:
            category = app.get_argument('category', default=None, strip=True)
            if category and category != 'null':
                category = ObjectId(category)
        except Exception as err:
            raise QueryMakerError(err)

        if 'category' not in query and category:
            logger.debug('CategoryFilterMaker.update_query for category %s', category)
            if category == 'null':
                query['category'] = {'$exists': False}
            else:
                query['category'] = category

        return query, projection

