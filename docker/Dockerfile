FROM python:3.4
MAINTAINER "ppcelery@gmail.com"

RUN \
    mkdir /www && \
    git clone https://github.com/Laisky/laisky-blog.git /root/www/gargantua

WORKDIR /root/www/gargantua

RUN \
    pip install --upgrade pip && \
    pip install --upgrade -r requirements.txt

RUN \
    python setup.py install

ENV HOME /root

ENTRYPOINT ["python", "-m", "gargantua"]
