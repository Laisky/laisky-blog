import re

import pymongo

conn = pymongo.MongoClient('localhost', 27016)
db = conn['blog']


# regex = re.compile('http://\w+\.\w+\.\w+\.\w+\.clouddn\.com')

for docu in db.posts.find():
    # docu['post_content'] = regex.sub('https://blog.laisky.com/qiniu', docu['post_content'])
    docu['post_content'] = docu['post_content'].replace('http://cinderellananako.files.wordpress.com/', 'https://blog.laisky.com/uploads/')
    if '[post_markdown]' in docu:
        docu['post_markdown'] = docu['post_markdown'].replace('http://cinderellananako.files.wordpress.com/', 'https://blog.laisky.com/uploads/')
        # docu['post_markdown'] = regex.sub('https://blog.laisky.com/qiniu', docu['post_markdown'])

    db.posts.update({'_id': docu['_id']}, {'$set': docu})
