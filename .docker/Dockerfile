FROM python:3.8.7-buster

RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ make gcc git build-essential ca-certificates curl \
    libxslt-dev libxml2-dev libc-dev libssl-dev libffi-dev zlib1g-dev \
    && update-ca-certificates


RUN mkdir /www && \
    git clone --single-branch --branch dist https://github.com/Laisky/laisky-blog.git --depth=1 /root/www/gargantua

WORKDIR /root/www/gargantua

RUN git branch -a
RUN python setup.py install

ENV HOME /root

CMD python -m gargantua --port=27850 --dbhost=mongodb --dbport=27017 --debug=false
