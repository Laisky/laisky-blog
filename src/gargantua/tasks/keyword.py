import logging
import datetime

from tornado.options import options
import pymongo
import jieba.analyse

from ..const import LOG_NAME


log = logging.getLogger(LOG_NAME)


def bind_task(ioloop):
    def callback(*args, **kw):
        when = ioloop.time() + 60 * 60
        log.debug('add new task load_keywords at {}'.format(when))
        load_keywords(*args, **kw)
        ioloop.call_at(when, callback, *args, **kw)

    when = ioloop.time() + 10
    ioloop.call_at(when, callback, dbhost=options.dbhost, dbport=options.dbport)


def load_keywords(dbhost='localhost', dbport=27017):
    log.debug('load_keywords for dbhost {}, dbport {}'.format(dbhost, dbport))

    conn = pymongo.MongoClient(dbhost, dbport)
    db = conn.blog

    contents = []
    for docu in db.posts.find({'post_password': ''}, {'post_content'}):
        contents.append(docu['post_content'])

    c = '\t'.join(contents)
    keywords = jieba.analyse.extract_tags(c, topK=30, allowPOS=('ns'))

    db.statistics.update(
        {'types': 'keyword'},
        {'$set': {
            'types': 'keyword',
            'keywords': keywords,
            'modified_at_gmt': datetime.datetime.utcnow()
        }}, upsert=True
    )


if __name__ == '__main__':
    load_keywords()
