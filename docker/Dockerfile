# build Gragantua

FROM ppcelery/dockerfile-python
MAINTAINER "ppcelery@gmail.com"

# install pyenv
RUN \
    source /root/.bashrc && \
    mkdir /www && \
    git clone https://github.com/Laisky/laisky-blog.git /root/www/gargantua && \
    pyenv global 3.4.1 && \
    pip install --upgrade pip && \
    cd /root/www/gargantua && \
    pip install --upgrade -r requirements.txt && \
    python setup.py develop

# Set environment variables.
ENV HOME /root

# Define working directory.
WORKDIR /root

# Define default command.
CMD ["/root/.pyenv/shims/python", "-m", "gargantua"]
