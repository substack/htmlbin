var fs = require('fs');
var path = require('path');
var lexi = require('lexicographic-integer');
var url = require('url');
var defined = require('defined');
var hyperstream = require('hyperstream');
var through = require('through2');

var ecstatic = require('ecstatic');
var est = ecstatic(path.join(__dirname, 'static'));

var render = {
    recent: require('./render/recent.js')
};

module.exports = function (db, store, opts) {
    var b = new HTMLBin(db, store, opts);
    return function (req, res) { b.exec(req, res) };
};

function HTMLBin (db, store, opts) {
    if (!(this instanceof HTMLBin)) return new HTMLBin(db, store, opts);
    this.db = db;
    this.store = store;
    this.age = Math.floor(60*60*24*365.25*100);
    this.options = opts || {};
    this.options.allowPost = defined(this.options.allowPost, true);
}

HTMLBin.prototype.exec = function (req, res) {
    var hparts = (req.headers.host || '').split('.');
    var hash = hparts[0];
    var proto = req.socket.encrypted ? 'https:' : 'http:';
    function link (h) {
        return proto + '//' + h + '.' + hparts.join('.')
    }
    
    if (/^[A-Fa-f0-9]{8,}$/.test(hash) && req.method === 'GET'
    && req.url === '/cache.manifest') {
        res.setHeader('cache-control', 'max-age=' + this.age);
        res.setHeader('content-type', 'text/cache-manifest; charset=UTF-8');
        res.end('CACHE MANIFEST\n'
            + '/\n'
            + '/cache.manifest\n'
            + 'NETWORK:\n'
            + '*\n'
        );
    }
    else if (/^[A-Fa-f0-9]{8,}$/.test(hash) && req.method === 'GET') {
        this._loadFile(hash, res);
    }
    else if ((this.options.allowPost && req.method === 'POST')
    || req.method === 'PUT') {
        var save = this._saveFile(req, function (err, hash) {
            if (err) {
                res.statusCode = 500;
                res.end(err + '\n');
            }
            else res.end(link(hash) + '\n')
        });
        if (req.url.split('?')[0] !== '/raw') {
            save.write('<html manifest="cache.manifest">\n');
        }
        req.pipe(save);
    }
    else if (req.url === '/') {
        res.setHeader('content-type', 'text/html; charset=UTF-8');
        read('index.html').pipe(hyperstream({
            '#recent': this.db.createReadStream({
                limit: 20,
                gt: 'recent!',
                lt: 'recent!~',
                reverse: true
            }).pipe(render.recent(proto, req.headers.host || '')),
            '#cmd': { _text: read('cmd.txt') }
        })).pipe(res);
    }
    else if (req.url === '/recent') {
        var params = url.parse(req.url);
        var opts = {
            limit: defined(params.limit, 100),
            gt: 'recent!' + defined(params.gt, ''),
            lt: 'recent!~',
            reverse: true
        };
        var last = null;
        var write = function (row, enc, next) {
            last = row.key.split('!')[1] + '!~';
            this.push(row.key.split('!')[2] + '\n');
            next();
        };
        var end = function () {
            if (last) {
                res.addTrailers({
                    'link': '</recent?gt=' + last + '>; rel="next"'
                });
            }
            this.push(null);
        };
        this.db.createReadStream(opts).pipe(through.obj(write, end)).pipe(res);
    }
    else est(req, res);
};

HTMLBin.prototype._loadFile = function (hash, res) {
    var r = this.store.createReadStream({ key: hash });
    res.setHeader('cache-control', 'max-age=' + this.age);
    res.setHeader('content-type', 'text/html; charset=UTF-8');
    res.setHeader('access-control-allow-origin', '*');
    
    r.on('error', function (err) {
        res.removeHeader('max-age');
        res.setHeader('content-type', 'text/plain');
        
        if (err.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('not found\n');
        }
        else {
            res.statusCode = 500;
            res.end(err + '\n');
        }
    });
    r.pipe(res);
};

HTMLBin.prototype._saveFile = function (req, cb) {
    var self = this;
    var bytes = 0;
    var tr = through(function (buf, enc, next) {
        bytes += buf.length;
        if (bytes > 1024 * 1024 * 4) {
            res.statusCode = 400;
            res.end('too much data\n');
        }
        else {
            this.push(buf);
            next();
        }
    });
    var w = this.store.createWriteStream();
    w.on('error', cb);
    w.on('finish', function () {
        var key = 'recent!'
            + Buffer(lexi.pack(Date.now())).toString('hex')
            + '!' + w.key
        ;
        var rows = [
            {
                type: 'put',
                key: key,
                value: {
                    addr: req.socket.remoteAddress,
                    xaddr: req.headers['x-forwarded-for']
                }
            },
            {
                type: 'put',
                key: 'blob!' + w.key,
                value: { size: bytes }
            }
        ];
        self.db.batch(rows, function (err) {
            if (err) cb(err)
            else cb(null, w.key)
        });
    });
    tr.pipe(w);
    return tr;
}

function read (file) {
    return fs.createReadStream(path.join(__dirname, 'static', file));
}
