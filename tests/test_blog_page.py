from urllib.parse import urlparse

from tornado.testing import AsyncHTTPTestCase
from tornado.ioloop import IOLoop

from gargantua.app import Application


GA_ID = 'UA-65521906-1'


class TestBlogPage(AsyncHTTPTestCase):

    def get_app(self):
        self.app = Application()
        return self.app

    def get_new_ioloop(self):
        return IOLoop.instance()

    def test_index_redirect(self):
        """测试博客首页的跳转和 404 页面
        """
        self.http_client.fetch(self.get_url('/'), self.stop)
        resp = self.wait()
        self.assertEqual(resp.code, 200)
        self.assertEqual(urlparse(resp.effective_url).path, '/404.html')
        # check content
        content = resp.body.decode('utf-8')
        self.assertIn(GA_ID, content)
        self.assertIn('<h1>Page Not Found</h1>', content)

    def test_archives_page(self):
        """测试博客文章页
        """
        self.http_client.fetch(self.get_url('/archives/'), self.stop)
        resp = self.wait()
        self.assertEqual(resp.code, 200)
        content = resp.body.decode('utf-8')
        self.assertIn('文章归档', content)
        self.assertIn('Profile', content)
        self.assertIn('管理', content)
        self.assertIn('标签', content)
        self.assertIn(GA_ID, content)
