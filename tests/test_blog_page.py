from urllib.parse import urlparse

from tornado.httpclient import AsyncHTTPClient
from tornado.testing import AsyncTestCase, gen_test


class TestBlogPage(AsyncTestCase):

    def setUp(self):
        self.prefix = 'http://localhost:27850/'
        super().setUp()

    @gen_test
    def test_index_redirect(self):
        """测试博客首页的跳转和 404 页面
        """
        gid = 'UA-65521906-1'
        expect_page_content = '<h1>Page Not Found</h1>'

        url = self.prefix
        httpclient = AsyncHTTPClient(self.io_loop)
        resp = yield httpclient.fetch(url)

        self.assertEqual(resp.code, 200)
        self.assertEqual(urlparse(resp.effective_url).path, '/404.html')
        # check content
        content = resp.body.decode('utf-8')
        self.assertIn(gid, content)
        self.assertIn(expect_page_content, content)
