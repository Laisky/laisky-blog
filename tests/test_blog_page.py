from urllib.parse import urlparse

from tornado.httpclient import AsyncHTTPClient
from tornado.testing import AsyncTestCase, gen_test


class TestBlogPage(AsyncTestCase):

    def setUp(self):
        self.prefix = 'http://blog.laisky.com/'
        super().setUp()

    @gen_test
    def test_index_redirect(self):
        """测试博客首页的跳转和 404 页面
        """
        gid = 'UA-65521906-1'

        url = self.prefix
        httpclient = AsyncHTTPClient(self.io_loop)
        resp = yield httpclient.fetch(url)

        self.assertEqual(resp.code, 200)
        self.assertEqual(urlparse(resp.effective_url).path, '/archives/')
        # check content
        content = resp.body.decode('utf-8')
        self.assertIn(gid, content)
        self.assertIn('class="post post-container">', content)
        self.assertIn('<h3>Profile</h3>', content)
