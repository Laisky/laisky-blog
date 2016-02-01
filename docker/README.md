Gargantua Dockerfile
===

```sh
$ docker run -idt \
    --name gargantua_00 \
    -p 27850:27850 \
    --link mongo32:mongo32 \
    ppcelery/laisky-blog \
        /root/.pyenv/shims/python \
        -m gargantua \
        --dbhost=mongo32 \
        --dbport=27016 \
        --debug=false \
        --mail_passwd=xxxxx
```
