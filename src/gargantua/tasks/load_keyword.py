import datetime

import pymongo
import jieba.analyse


def main():
    conn = pymongo.MongoClient('localhost', 27017)
    db = conn.blog

    contents = []
    for docu in db.posts.find({'post_password': ''}, {'post_content'}):
        contents.append(docu['post_content'])

    c = '\t'.join(contents)
    keywords = jieba.analyse.extract_tags(c, topK=30, allowPOS=('ns'))

    db.statistics.update(
        {'types': 'keyword'},
        {'$set': {
            'keywords': keywords,
            'modified_at_gmt': datetime.datetime.utcnow()
        }}, upsert=True
    )


if __name__ == '__main__':
    main()
