Deploy by Docker
===

## Run docker container by hand

[![](https://badge.imagelayers.io/ppcelery/laisky-blog:latest.svg)](https://imagelayers.io/?images=ppcelery/laisky-blog:latest 'Get your own badge on imagelayers.io')

```sh
$ sudo docker run ppcelery/laisky-blog \
    run_gargantua \
        --dbhost=mongo32 \
        --dbport=27017 \
        --debug=false \
        --mail_host='smtp.mailgun.org' \
        --mail_port=25 \
        --mail_subject='Gargantua Error' \
        --mail_from_addr='gargantua@laisky.com' \
        --mail_to_addrs='a@gmail.com;b@gmail.com;c@gmail.com' \
        --mail_username=<YOUR_SMTP_USERNAME> \
        --mail_passwd=<YOUR_SMTP_PASSWORD
```


## Deploy by docker compose

```sh
$ cd docker
$ docker-compose up -d
```
