#!/bin/sh

### Install SSL Certificatin

#### Use mkcert to generate cert

1. init mkcert

```
mkcert -install
```

2. create the cert

```
mkcert -cert-file localhost.pem \
       -key-file localhost.key \
        ${local_url} localhost 127.0.0.1 ::1
```
