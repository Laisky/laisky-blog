# build Gragantua

FROM python:3.4
MAINTAINER "ppcelery@gmail.com"

# clone source code from git
RUN \
    mkdir /www && \
    git clone https://github.com/Laisky/laisky-blog.git /root/www/gargantua


# packages
RUN \
    pip install --upgrade pip && \
    cd /root/www/gargantua && \
    pip install --upgrade -r requirements.txt

# install gargantua
RUN \
    python setup.py install

# Set environment variables.
ENV HOME /root

# Define working directory.
WORKDIR /root

# Define default command.
CMD ["/root/.pyenv/shims/python", "-m", "gargantua"]
