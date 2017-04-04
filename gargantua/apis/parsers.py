"""Parsers to parse results will be return to client
"""
from abc import ABC, abstractclassmethod
import datetime

import tornado
from bson import ObjectId

from gargantua.utils import logger, utc2cst_timestamp, MongoParser, debug_wrapper


class ParserError(Exception):
    pass


class BaseParser(ABC):

    @abstractclassmethod
    @tornado.gen.coroutine
    @debug_wrapper
    def parse_results(cls, app, results):
        raise tornado.gen.Return(results)


class MongoDataParser(BaseParser):

    @classmethod
    @tornado.gen.coroutine
    @debug_wrapper
    def parse_results(cls, app, results):
        mparser = MongoParser()
        raise tornado.gen.Return(mparser.parse(results))


class DatetimeParser(BaseParser):

    @classmethod
    @tornado.gen.coroutine
    @debug_wrapper
    def parse_results(cls, app, results):
        for docu in results:
            for k, v in docu.items():
                if isinstance(v, datetime.datetime):
                    docu[k] = utc2cst_timestamp(v)

        raise tornado.gen.Return(results)



class PostContentTruncateParser(BaseParser):

    @classmethod
    @tornado.gen.coroutine
    @debug_wrapper
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

        raise tornado.gen.Return(results)


class PostContentParser(BaseParser):

    @classmethod
    @tornado.gen.coroutine
    @debug_wrapper
    def parse_results(cls, app, results):
        logger.debug('PostContentParser.parse_results')
        try:
            plaintext = app.get_argument('plaintext', default='false', strip=True)
            assert(plaintext in ['true', 'false'])
        except (ValueError, AssertionError) as err:
            raise ParserError(err)
        else:
            plaintext = plaintext == 'true'

        r = []
        for docu in results:
            content = docu['post_content']
            if docu.get('post_password'):
                content = ''
            else:
                if plaintext:
                    content = app.plaintext_content(content)

            if 'category' in docu:
                category = (yield app.db.categories.find_one({'_id': ObjectId(docu['category'])})) or {}
            else:
                category = {}

            r.append({
                'post_tags': docu.get('post_tags', []),
                'post_category': category.get('name'),
                'post_title': docu['post_title'],
                'post_type': docu.get('post_type', 'markdown'),
                'link': app.hyperlink_postname(docu['post_name']),
                'post_name': docu['post_name'],
                'post_markdown': docu.get('post_markdown'),
                'post_menu': docu.get('post_menu'),
                'post_content': content,
                'post_id': str(docu['_id']),
                'post_author': str(docu['post_author']),
                'post_modified_gmt': docu['post_modified_gmt'],
                'post_created_at': docu['post_created_at'],
                'post_status': docu['post_status'],
            })

        raise tornado.gen.Return(r)

