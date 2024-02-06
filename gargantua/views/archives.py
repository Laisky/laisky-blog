"""View about any articles.
有关文章的一切
"""

import urllib

import pymongo
import tornado
import tornado.httpclient
import html2text
from bson import ObjectId
from lxml import etree

from gargantua.utils import debug_wrapper, unquote_fr_mongo, logger, \
    render_md_to_html, utcnow
from gargantua.settings import N_POST_PER_PAGE, ERROR
from gargantua.models import ArticlesModel
from .base import BaseHandler
from .exceptions import PostValidatorError


class ArticleMixin():

    def parse_post_name(self, name):
        return urllib.parse.quote(name).lower()

    def get_cookie_name(self, post_name):
        return 'post.auth.{}'.format(post_name)

    def shortly_content(self, content, length=1000):
        return html2text.html2text(content)[: length]

    def extract_reveal_html(self, html):
        logger.debug('extract_reveal_html for html {}'.format(html[: 50]))

        tree = etree.HTML(html)
        node = tree.xpath('//div[@class="reveal"]')
        ret = etree.tostring(node[0], encoding='unicode')

        if '{{' in ret:
            return '{% raw %}' + ret + '{% endraw %}'
        else:
            return ret


class PostsHandler(BaseHandler, ArticleMixin):

    """APIs about posts"""

    async def get(self, url=None, *args, **kw):
        logger.info('GET PostsHandler {}'.format(url))

        router = {
            'archives': self.get_post_by_page,       # 按页数获取文章
            'search': self.get_post_by_keyword,      # 按关键词搜索
            'publish': self.get_new_post,            # 发表新文章
            'p': self.get_post_by_name,              # 单篇文章的页面
            'api/posts/keywords': self.get_post_keywords,
            'api/posts/get-amend-post': self.get_amend_post,            # 编辑文章
            'rss': self.get_rss,                     # 获取订阅
            'api/posts/get-post-by-page': self.get_post_by_page,
        }
        router.get(url, self.redirect_404)(*args, **kw)

    async def post(self, url=None, *args, **kw):
        logger.info('POST PostsHandler {}'.format(url))

        router = {
            'api/posts/post-article-password': self.post_article_password,
            'api/posts/publish': self.post_new_article,
        }
        router.get(url, self.redirect_404)(*args, **kw)

    @tornado.web.authenticated
    async def patch(self, url):
        """Update existed article
        """
        logger.info('PATCH PostsHandler for url {}'.format(url))
        router = {
            'api/posts/amend': self.patch_article,
        }
        router.get(url)()

    @tornado.web.authenticated
    def delete(self):
        """Delete existed article
        """
        pass

    @tornado.gen.coroutine
    @debug_wrapper
    def get_rss(self):
        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)])

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            if docu.get('post_password'):
                continue

            posts.append(unquote_fr_mongo(docu))

        self.render_post('rss.html', posts=posts)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_keywords(self):
        docu = yield self.db.statistics.find_one({'types': 'keyword'})
        self.write_json(data=docu['keywords'])
        self.finish()

    @tornado.web.authenticated
    @tornado.gen.coroutine
    @debug_wrapper
    def get_amend_post(self):
        post_name = self.get_argument('post-name', strip=True)
        post_name = urllib.parse.quote(post_name)
        logger.info('get_amend_post with post_name {}'.format(post_name))

        post = yield self.db.posts.find_one({'post_name': post_name})
        post = unquote_fr_mongo(post)
        if not post:
            raise tornado.httpclient.HTTPError(406, 'post-name not exists')

        self.render2('amend/index.html', post=post)
        self.finish()

    def validate_post(self, create_new=False):
        try:
            post_title = self.get_argument('postTitle', strip=True)
            post_name = self.get_argument('postName', strip=True)
            post_name = urllib.parse.quote(post_name).lower()
            post_content = self.get_argument('postContent')
            post_type = self.get_argument('postType', strip=True, default='text')

            assert post_name, 'post_name cannot be empry!'
        except Exception as err:
            logger.exception(err)
            raise PostValidatorError('Post arguments error!')
        else:
            post_docu = {
                'post_modified_gmt': utcnow(),
                'post_status': 'publish',
                'comment_status': 'open',
                'post_title': post_title,
                'post_name': post_name,
                'post_type': post_type,
            }
            if create_new:
                post_docu.update({
                    'post_author': self.current_user['_id'],
                    'post_created_at': utcnow(),
                })

            logger.debug('validate_post for post_title {}, post_name {}, '
                         'post_content {}, post_type {}'
                         .format(post_title, post_name, post_content, post_type))

        post_menu = None
        if post_type == 'slide':
            # extract slide body from the file generated by ipython nbconvert
            post_content = self.extract_reveal_html(post_content)
        elif post_type == 'markdown':
            # renfer github flavor markdown to html
            post_markdown = post_content
            post_content, post_menu = render_md_to_html(post_content, is_extract_menu=True)
        else:
            logger.debug('unknown post_type: {}'.format(post_type))
            raise PostValidatorError('unknown post_type')

        post_docu.update({
            'post_content': post_content,
            'post_menu': post_menu,
        })
        if post_type == 'markdown':
            post_docu.update({
                'post_markdown': post_markdown,
            })

        return post_docu

    @tornado.web.authenticated
    @tornado.gen.coroutine
    @debug_wrapper
    def patch_article(self):
        """Update article."""
        logger.info('patch_article')
        try:
            post_docu = self.validate_post(create_new=False)
        except PostValidatorError as err:
            self.http_400_bad_request(err=err)
            self.finish()
            return

        try:
            yield self.db.posts.update(
                {'post_name': post_docu['post_name']},
                {'$set': post_docu},
            )
        except Exception as err:
            logger.exception(err)
            self.http_400_bad_request(err=err)
        else:
            self.write_json(msg='amend article {}'
                            .format(post_docu['post_name']))
        finally:
            self.finish()

    @tornado.web.authenticated
    @tornado.gen.coroutine
    @debug_wrapper
    def post_new_article(self):
        """Create new article."""
        logger.info('post_new_article')
        try:
            post_docu = self.validate_post(create_new=True)
        except PostValidatorError as err:
            self.http_400_bad_request(err=err)
            self.finish()
            return

        try:
            yield self.db.posts.insert(post_docu)
        except Exception as err:
            logger.exception(err)
            self.http_400_bad_request(err=err)
        else:
            self.write_json(msg='post new article {}'
                            .format(post_docu['post_name']))
        finally:
            self.finish()

    @tornado.web.authenticated
    def post_article_password(self):
        """Validate the password of locked article.
        """
        logger.info("post_article_password")

        name = self.parse_post_name(self.get_argument('name', default='', strip=True))
        password = self.get_argument('password', strip=True)
        logger.debug(f'post_article_password for {name=}')

        post = yield ArticlesModel.get({'post_name': name})
        if not post:
            self.set_status(202, 'Post name not exists.')
            self.write_json(msg='post_name 不存在', status=ERROR)
            self.finish()
            return
        elif password != post['post_password']:
            self.set_status(202, 'Password wrong.')
            self.write_json(msg='密码错误', status=ERROR)
            self.finish()
            return

        cookie_name = self.get_cookie_name(name)
        self.set_secure_cookie(cookie_name, password, expires_days=None)
        self.write_json(msg='ok')

    @tornado.web.authenticated
    def get_new_post(self):
        logger.info('get_new_post')
        self.render2('archives/publish.html')
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_name(self, name):
        logger.info('get_post_by_name for name {}'.format(name))

        name = self.parse_post_name(name)
        post = yield ArticlesModel.get({'post_name': name})
        if not post:
            self.redirect_404()
            return

        if post.get('post_password'):
            cookie_name = self.get_cookie_name(name)
            cookie = self.get_secure_cookie(cookie_name)
            logger.debug('get cookie {}'.format(cookie))
            if not cookie or cookie.decode() != post['post_password']:
                self.render2('archives/ajax/auth.html', post_name=post['post_name'])
                return

        post['post_type'] = post.get('post_type', 'text')
        self.render2('archives/article.html', post=post)
        self.finish()

    def get_post_by_keyword(self):
        logger.info('GET get_post_by_keyword')

        keyword = self.get_argument('keyword', strip=True)
        logger.debug('GET get_post_by_keyword for keyword {}'.format(keyword))

        q = 'https://cse.google.com/cse/publicurl?cx=004733495569415005684:-c6y46kjqva&q={keyword}'
        self.redirect(q.format(keyword=keyword, permanent=True))

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_page(self):
        logger.info('GET get_post_by_page')

        try:
            page = int(self.get_argument('page', strip=True, default=1))
            is_full = self.get_argument('is_full', strip=True, default=False)
            logger.debug('get_post_by_page for page {}'.format(page))
        except ValueError as err:
            logger.error('when get_post_by_page: ', exc_info=err)
            self.finish()
            return

        skip = (page - 1) * N_POST_PER_PAGE
        cursor = self.db.posts.find()
        cursor.sort([('_id', pymongo.DESCENDING)]) \
            .limit(N_POST_PER_PAGE) \
            .skip(skip)
        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            docu = unquote_fr_mongo(docu)
            if not is_full:
                if docu.get('post_password'):
                    docu['post_content'] = """
                        <div class="preview">
                            <span class="glyphicon glyphicon-lock" aria-hidden="true"></span>
                        </div>
                    """
                else:
                    docu['post_content'] = self.shortly_content(docu['post_content'], 500)

            posts.append(docu)

        # tags
        tags = (yield self.db.statistics.find_one(
            {'types': 'keyword'},
            {'keywords': 1}
        ))['keywords']

        self.render_post('archives/archives.html',
                         posts=posts, current_page=page, tags=tags)
        self.finish()

    @tornado.gen.coroutine
    @debug_wrapper
    def get_post_by_id(self):
        try:
            is_full = self.get_argument('is_full', strip=True, default=False)
            _id = self.get_argument('id', strip=True)
        except ValueError:
            self.finish()
            return
        else:
            logger.debug('get_post_by_id for _id {}, is_full {}'.format(_id, is_full))

        docu = yield self.db.posts.find_one({'_id': ObjectId(_id)})
        if docu:
            docu['post_created_gmt'] = \
                docu['_id'].generation_time.timestamp() * 1000
            docu['_id'] = str(docu['_id'])
            docu['post_modified_gmt'] = \
                docu['post_modified_gmt'].timestamp() * 1000
            if not is_full:
                docu['post_content'] = docu['post_content'][: 1000]

        self.write_json(data=docu)
        self.finish()
