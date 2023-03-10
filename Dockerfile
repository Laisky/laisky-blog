# docker build . -t ppcelery/laisky-blog:test
FROM python:3.7.16-bullseye

RUN apt update && apt upgrade -y \
    && apt-get install -y --no-install-recommends g++ make gcc git build-essential ca-certificates \
        libbz2-dev libc6-dev libffi-dev liblapack-dev libldap2-dev libopenblas-dev libsasl2-dev \
        libsqlite3-dev libcurl4-openssl-dev libprotobuf-c-dev protobuf-c-compiler \
        libprotobuf-c1 zlib1g-dev libssl-dev libncurses-dev libreadline-dev liblzma-dev \
    && update-ca-certificates
    # && rm -rf /var/lib/apt/lists/*

RUN apt-get install -y npm ruby-dev \
    && npm install -g gulp-cli bower@1.8.4 \
    && gem install compass

WORKDIR /www/gargantua
ADD . .

RUN cd /www/gargantua \
    && npm i \
    && gulp \
    && cd gargantua/static/vendor/ && bower install --allow-root

RUN git branch -a
RUN python setup.py install

CMD python -m gargantua --port=27850 --dbhost=mongodb --dbport=27017 --debug=false
