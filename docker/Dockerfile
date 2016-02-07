# build Gragantua

FROM python:3.4
MAINTAINER "ppcelery@gmail.com"

# clone source code from git
RUN \
    mkdir /www && \
    git clone https://github.com/Laisky/laisky-blog.git /root/www/gargantua

# Define working directory.
WORKDIR /root/www/gargantua

# packages
RUN \
    pip install --upgrade pip && \
    pip install --upgrade -r requirements.txt

# install gargantua
RUN \
    python setup.py install

# Set environment variables.
ENV HOME /root

# Define default command.
CMD ["python", "-m", "gargantua"]
