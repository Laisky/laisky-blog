import tornado

from gargantua.utils import debug_wrapper, \
    utc2cst_timestamp, logger
from .base import ApiHandler
from .filters import OidSortFilter, LimitFilter, SkitFilter


class TweetsApiHandler(ApiHandler):

    _collection = 'tweets'
    _filters = (OidSortFilter, LimitFilter, SkitFilter)

    def get_col(self):
        return self.application.conn.twitter.tweets

    def parse_docu(self, docu, truncate=None):

        return {
            'created_at': utc2cst_timestamp(docu['created_at']),
            'text': docu['text'],
        }

    @tornado.gen.coroutine
    @debug_wrapper
    def list(self):
        logger.info('TweetsApiHandler list')

        try:
            truncate = int(self.get_argument('truncate', default='300', strip=True))
            topic = self.get_argument('topic', default=None, strip=True)
            assert(truncate >= 0)
        except (ValueError, AssertionError) as err:
            logger.exception(err)
            self.http_400_bad_request(err=err)
            return

        if topic:
            select = {'topics': topic}
        else:
            select = None

        cursor = self.get_cursor(select)
        if not cursor:
            return

        posts = []
        while (yield cursor.fetch_next):
            docu = cursor.next_object()
            parsed_docu = self.parse_docu(
                docu, truncate=truncate
            )
            posts.append(parsed_docu)

        col = self.get_col()
        total = yield col.count()
        self.success(posts, total=total)
