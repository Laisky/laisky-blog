from urllib.parse import urlparse

from tornado.testing import AsyncHTTPTestCase
from tornado.ioloop import IOLoop

from gargantua.app import Application


GA_ID = 'UA-65521906-1'


class GargantuaTestCase(AsyncHTTPTestCase):

    def get_app(self):
        self.app = Application()
        return self.app

    def get_new_ioloop(self):
        return IOLoop.instance()


class TestBlogPage(GargantuaTestCase):

    def test_index_redirect(self):
        """测试跳转和 404 页面
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
        """测试博客文章首页
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

    def test_profile_page(self):
        """测试个人说明页
        """
        self.http_client.fetch(self.get_url('/profile/'), self.stop)
        resp = self.wait()
        self.assertEqual(resp.code, 200)
        content = resp.body.decode('utf-8')
        self.assertIn('<div class="row profile-container">', content)
        self.assertIn(GA_ID, content)

    def test_login_page(self):
        """测试登陆页
        """
        self.http_client.fetch(self.get_url('/login/'), self.stop)
        resp = self.wait()
        self.assertEqual(resp.code, 200)
        content = resp.body.decode('utf-8')
        self.assertIn('login-body', content)
        self.assertIn(GA_ID, content)

    def test_posts_page(self):
        """测试文章页
        """
        scenarios = [
            {'url': '/p/justice_01/', 'content': '公正：该如何是好'},  # 普通文章
            # {'url': '/p/justice_01/', 'content': '公正：该如何是好'},  # markdown
            # {'url': '/p/justice_01/', 'content': '公正：该如何是好'},  # slide
        ]
        for scena in scenarios:
            self.http_client.fetch(self.get_url(scena['url']), self.stop)
            resp = self.wait()
            self.assertEqual(resp.code, 200)
            content = resp.body.decode('utf-8')
            self.assertIn(scena['content'], content)
            self.assertIn(GA_ID, content)
