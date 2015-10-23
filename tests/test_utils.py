import random
from string import ascii_lowercase
from unittest import TestCase

import jwt

from gargantua.utils import render_md_to_html, \
    generate_passwd, validate_passwd, generate_token, validate_token


class TestMarkdown(TestCase):

    def test_render_md_to_html(self):
        scenarios = (
            {'md': 'title\n===', 'expect': '<div class="highlight"><h1>title</h1>\n</div>'},
            {'md': '#1\n##2', 'expect': '<div class="highlight"><h1>1</h1>\n\n<h2 id="2">2</h2>\n</div>'},
        )

        for scena in scenarios:
            self.assertEqual(render_md_to_html(scena['md']), scena['expect'])


class TestEncrypt(TestCase):

    def test_bcrypt(self):
        passwd = ''.join([random.choice(ascii_lowercase) for _ in range(15)])
        wrong = passwd[:-1] + '0'
        hashed = generate_passwd(passwd)
        self.assertTrue(validate_passwd(passwd, hashed))
        self.assertFalse(validate_passwd(wrong, hashed))

    def test_jwt(self):
        passwd = ''.join([random.choice(ascii_lowercase) for _ in range(15)])
        wrong = passwd[:-1] + '0'
        j = {'username': 'laisky'}
        token = generate_token(j, passwd)
        self.assertTrue(validate_token(token, passwd))
        self.assertRaises(jwt.DecodeError, validate_token, token, wrong)
