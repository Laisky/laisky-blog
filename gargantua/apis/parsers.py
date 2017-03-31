"""Parsers to parse results will be return to client
"""
from abc import ABC, abstractclassmethod
import datetime

import pymongo

from gargantua.utils import logger, utc2cst_timestamp, MongoParser


class ParserError(Exception):
    pass


class BaseParser(ABC):

    @abstractclassmethod
    def parse_results(cls, app, results):
        return results


class MongoDataParser(BaseParser):

    @classmethod
    def parse_results(cls, app, results):
        mparser = MongoParser()
        return mparser.parse(results)


class DatetimeParser(BaseParser):

    @classmethod
    def parse_results(cls, app, results):
        for docu in results:
            for k, v in docu.items():
                if isinstance(v, datetime.datetime):
                    docu[k] = utc2cst_timestamp(v)

        return results



class PostContentTruncateParser(BaseParser):

    @classmethod
    def parse_results(cls, app, results):
        try:
            truncate = int(app.get_argument('truncate', default=-1))
        except Exception as e:
            raise ParserError(e)
        else:
            logger.debug('TruncateParser.parse_results for truncate %s', truncate)

        if truncate >= 0:
            for docu in results:
                docu['post_content'] = docu['post_content'][:truncate]

        return results
