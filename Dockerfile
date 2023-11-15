# docker build . -t ppcelery/laisky-blog:test
FROM python:3.7.16-bullseye

RUN apt update && apt upgrade -y \
    && apt-get install -y --no-install-recommends --fix-missing g++ make gcc git build-essential ca-certificates \
        libbz2-dev libc6-dev libffi-dev liblapack-dev libldap2-dev libopenblas-dev libsasl2-dev \
        libsqlite3-dev libcurl4-openssl-dev libprotobuf-c-dev protobuf-c-compiler \
        libprotobuf-c1 zlib1g-dev libssl-dev libncurses-dev libreadline-dev liblzma-dev \
    && update-ca-certificates
    # && rm -rf /var/lib/apt/lists/*

RUN apt-get install -y --fix-missing npm ruby-dev
RUN npm install -g gulp-cli bower@1.8.4 yarn
RUN gem install compass

WORKDIR /www/gargantua
ADD requirements.txt requirements.txt
ADD package.json package.json
ADD package-lock.json package-lock.json
ADD yarn.lock yarn.lock
ADD requirements.txt requirements.txt
ADD gargantua/static/vendor gargantua/static/vendor
ADD node_modules node_modules

RUN cd gargantua/static/vendor/ && bower install --allow-root
RUN pip install -r requirements.txt

RUN cd /www/gargantua \
    && yarn

ADD . .
RUN gulp
RUN git branch -a
RUN python setup.py develop
RUN rm /www/gargantua/gargantua/settings/settings.py || true

CMD python -m gargantua --port=27850 --dbhost=mongodb --dbport=27017 --debug=false
