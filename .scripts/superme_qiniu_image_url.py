import re
from random import randint

import pymongo

conn = pymongo.MongoClient('localhost', 27016)
db = conn['blog']


def generate_domain():
    ss = 's1'
    n = randint(0, 10)
    if 0 <= n < 3:
        ss = 's2'
    elif 3 <= n < 6:
        ss = 's3'

    return 'https://{}.laisky.com/images/'.format(ss)



regex = re.compile(r'https://blog\.laisky\.com/qiniu/')

for docu in db.posts.find():
    docu['post_content'] = regex.sub(generate_domain(), docu['post_content']).replace('?imageMogr2/format/webp', '')
    if 'post_markdown' in docu:
        docu['post_markdown'] = regex.sub(generate_domain(), docu['post_markdown']).replace('?imageMogr2/format/webp', '')

    db.posts.update({'_id': docu['_id']}, {'$set': docu})
