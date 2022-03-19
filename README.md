# blacklist-redis

A simple Node.js client for downloading banned IPs and inserting them into a redis set.
From [APIBAN](https://www.apiban.org) and [VoIPBL](http://www.voipbl.org/)

Original Source based on from Jambonz [apiban-redis](https://github.com/jambonz/apiban-redis) which is part of [Jambonz](https://www.jambonz.org/)

The node client also has the ability to import blacklists to mysql for Kamailio secfilter.

# Installation

This utility can be run as a shell command if installed globally, i.e.:

```bash
$ sudo npm install -g .

$ APIBAN_REDIS_SERVER=127.0.0.1 APIBAN_REDIS_PORT=6379 \
APIBAN_REDIS_KEY=my-blacklist \
APIBAN_API_KEY=your-apiban-key \
apiban-redis

fetched 250 ips, next ID 1644910929
fetched 250 ips, next ID 1645191645
fetched 2 ips, next ID 1645195595

Success! The redis set named my-blacklist now contains 502 ips
```
