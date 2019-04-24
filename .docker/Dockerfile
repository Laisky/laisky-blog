FROM python:3.7.3-alpine3.9


RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates && \
    update-ca-certificates

RUN apk add --no-cache gcc build-base git curl \
        libxslt-dev libxml2-dev libc-dev openssl-dev libffi-dev zlib-dev


RUN mkdir /www && \
    git clone --single-branch --branch dist https://github.com/Laisky/laisky-blog.git --depth=1 /root/www/gargantua

WORKDIR /root/www/gargantua

RUN git branch -a
RUN python setup.py install

ENV HOME /root

CMD python -m gargantua --port=27850 --dbhost=mongodb --dbport=27017 --debug=false

