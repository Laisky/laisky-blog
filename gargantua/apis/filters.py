"""过滤器
"""
from abc import ABC, abstractclassmethod

import pymongo

from gargantua.utils import logger


class FilterError(Exception):
    pass


class BaseFilter(ABC):

    @abstractclassmethod
    def query_cursor(self, app, cursor):
        return cursor


class OidSortFilter(BaseFilter):

    """根据 oid 进行排序"""

    def query_cursor(self, app, cursor):
        sort = app.get_argument('sort', default='des', strip=True)
        if sort == 'des':
            cursor.sort([('_id', pymongo.DESCENDING)])
        elif sort == 'asc':
            cursor.sort([('_id', pymongo.ASCENDING)])
        else:
            raise FilterError('Argument sort must be asc | des!')

        return cursor


class LimitFilter(BaseFilter):

    def query_cursor(self, app, cursor):
        try:
            limit = int(app.get_argument('limit', default='10', strip=True))
            assert limit > 0
        except Exception as err:
            logger.exception(err)
            raise FilterError('Argument limit not correct!')

        cursor.limit(limit)
        return cursor


class SkitFilter(BaseFilter):

    def query_cursor(self, app, cursor):
        try:
            skip = int(app.get_argument('skip', default='0', strip=True))
            assert skip >= 0
        except Exception as err:
            logger.exception(err)
            raise FilterError('Argument limit not correct!')

        cursor.skip(skip)
        return cursor
