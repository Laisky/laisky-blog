FROM python:3.4
MAINTAINER "ppcelery@gmail.com"

RUN mkdir /www \
    && git clone https://github.com/Laisky/laisky-blog.git /root/www/gargantua

WORKDIR /root/www/gargantua

RUN python setup.py install

ENV HOME /root
