import tornado

from gargantua.utils import debug_wrapper, \
    utc2cst_timestamp, logger
from .base import ApiHandler
from .filters import OidSortFilter, LimitFilter, SkitFilter


class PostApiHandler(ApiHandler):

    _collection = 'posts'
    _filters = (OidSortFilter, LimitFilter, SkitFilter)

    def parse_docu(self, docu, truncate=None, plaintext=False):
        content = docu['post_content']
        if docu.get('post_password'):
            content = ''
        else:
            if plaintext:
                content = self.plaintext_content(content)
            if truncate:
                content = self.truncate_content(content, truncate)

        return {
            'post_title': docu['post_title'],
            'post_type': docu.get('post_type', 'markdown'),
            'link': self.hyperlink_postname(docu['post_name']),
            'post_name': docu['post_name'],
            'post_markdown': docu.get('post_markdown'),
            'post_menu': docu.get('post_menu'),
            'post_content': content,
            'post_id': str(docu['_id']),
            'post_author': str(docu['post_author']),
            'post_modified_gmt': utc2cst_timestamp(docu['post_modified_gmt']),
            'post_created_at': utc2cst_timestamp(docu['post_created_at']),
            'post_status': docu['post_status'],
        }

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        logger.info('PostApiHandler list')

        try:
            plaintext = self.get_argument('plaintext', default='false', strip=True)
            truncate = int(self.get_argument('truncate', default='300', strip=True))
            assert(plaintext in ['true', 'false'])
            assert(truncate >= 0)
        except (ValueError, AssertionError) as err:
            logger.exception(err)
            self.http_400_bad_request(exc_info=err)
            return
        else:
            plaintext = plaintext == 'true'

        cursor = self.get_cursor()
        if not cursor:
            return

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            parsed_docu = self.parse_docu(
                docu, truncate=truncate, plaintext=plaintext
            )
            posts.append(parsed_docu)

        col = self.get_col()
        total = yield col.count()
        self.success(posts, total=total)

    def get_oidname(self):
        return 'post_name'
