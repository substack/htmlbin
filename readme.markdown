# htmlbin

host immutable html blobs on a content-addressed subdomain

free instance up and running at [https://htmlb.in](https://htmlb.in)
with a wildcard SSL cert in place

It's like neocities (which is excellent), but for immutable html content.

# upload example

You can use the free service on https://htmlb.in:

```
$ echo '<b>wow</b>' | htmlbin
https://567999e2a16bc72f5d86d2040d723bbb.f020cf80ced3aa8457e6e69bc306f8e5.htmlb.in
```

# server example

or you can run a server yourself:

```
$ htmlbin server -p 8000 &
$ htmlbin config set remote http://localhost:8000
$ echo '<i>pizza</i>' | htmlbin
http://385937a7b1101366aced05ba2ac084e2c.bbe6c7920024782f7a3562506dbb7f1.localhost:8000
```

# curl example

or you can just use curl:

```
$ echo '<i>pizza</i>' | curl -sT- http://localhost:8000
http://385937a7b1101366aced05ba2ac084e2c.bbe6c7920024782f7a3562506dbb7f1.localhost:8000
```

# usage

```
htmlbin {OPTIONS}
htmlbin upload {OPTIONS}

  -i --infile   Read from FILE or - for stdin (default: -)
  -r --remote   Use REMOTE as the remote endpoint. Overides config.

htmlbin server {OPTIONS}

  -p --port     Listen for HTTP requests on this port (default: 80/8000).
  -s --sslport  Listen for HTTPS requests (default: 443/8443).
  -u --uid      Run the server as USER.
  -g --gid      Run the server with group set to GID.
  -d --datadir  Where to put files
 
  SSL options:

  --key=KEYFILE    Load the private key from KEYFILE.
  --cert=CERTFILE  Load the certificate from CERTFILE.
  --pfx=PFXFILE    Load the combination keys and certificates from PFXFILE.

htmlbin config { get KEY | set KEY VALUE | rm KEY | list }

  * remote - where to push html payloads. default: https://htmlb.in

htmlbin help

  Show this message.

```

# todo

* Turn htmlbin into an LRU cache on top of bittorrent/webtorrent for bulk
long-term storage.
* Swarm mode to help store blobs on the network with some quotas.

# install

With [npm](https://npmjs.org) do:

```
npm install -g htmlbin
```

# licence

MIT
