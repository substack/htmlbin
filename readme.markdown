# htmlbin

host immutable html blobs on a content-addressed subdomain

free instance up and running at [https://htmlb.in](https://htmlb.in)
with a wildcard SSL cert in place

It's like neocities (which is excellent), but for immutable html content.

# example

Run a local server on port 8000:

```
$ htmlbin server -p 8000
```

Run 

# usage

```
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
