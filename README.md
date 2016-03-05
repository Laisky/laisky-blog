Gargantua
===

[![Crates.io](https://img.shields.io/crates/l/rustc-serialize.svg)]()
[![Build Status](https://travis-ci.org/Laisky/laisky-blog.svg?branch=master)](https://travis-ci.org/Laisky/laisky-blog)
[![Crates.io](https://img.shields.io/badge/version-v2.1.6-blue.svg)]()
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Gitter](https://badges.gitter.im/Laisky/laisky-blog.svg)](https://gitter.im/Laisky/laisky-blog?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

> Do not go gentle into that good night, Rage, rage against the dying of the light.

| ![](http://7xjvpy.dl1.z0.glb.clouddn.com/gargantua.jpg) |
|:--:|
| Laisky's New Blog |


## Deploy

### Git

```sh
$ sudo make
```

### Docker

[![](https://badge.imagelayers.io/ppcelery/laisky-blog:latest.svg)](https://imagelayers.io/?images=ppcelery/laisky-blog:latest 'Get your own badge on imagelayers.io')

```sh
$ sudo docker run ppcelery/laisky-blog \
    python -m gargantua \
    --dbhost=mongo32 \
    --dbport=27017 \
    --debug=false \
    --mail_host='smtp.mailgun.org'
    --mail_port=25
    --mail_subject='Gargantua Error'
    --from_addr='gargantua@laisky.com'
    --to_addrs='a@gmail.com;g@gmail.com;c@gmail.com'
    --mail_username=<YOUR_SMTP_USERNAME>
    --mail_passwd=<YOUR_SMTP_PASSWORD
    --mail_passwd=<YOUR_GMAIL_PASSWORD>
```


## Description

A simple blog by Python3


## Technology Stack

    - Backend
        - Python3
            - tornado
        - MongoDB3.0 wiredTiger
        - Nginx
        - Elasticsearch
        - Sentry

    - Frontend
        - SASS / Compass
        - JavaScript / jQuery
        - Bootstrap3


## CHANGELOG

[CHANGELOG.md](https://github.com/Laisky/laisky-blog/blob/master/CHANGELOG.md)

