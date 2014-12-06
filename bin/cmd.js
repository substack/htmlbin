#!/usr/bin/env node

var http = require('http');
var https = require('https');
var through = require('through2');
var hyperstream = require('hyperstream');
var lexi = require('lexicographic-integer');
var fs = require('fs');
var path = require('path');

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: { p: 'port' },
    default: { port: 8000, dir: './blob' }
});

var level = require('level');
var db = level('./db', { valueEncoding: 'json' });

var blob = require('content-addressable-blob-store');
var store = blob(argv);

var ecstatic = require('ecstatic');
var est = ecstatic(__dirname + '/static');

var server = http.createServer(function (req, res) {
    var host = (req.headers.host || '').split('.')[0];
    if (/^[A-Fa-f0-9]{8,}$/.test(host) && req.method === 'GET') {
        loadFile(host, res);
    }
    else if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(saveFile(function (err, hash) {
            if (err) {
                res.statusCode = 500;
                res.end(err + '\n');
            }
            else res.end(hash + '\n')
        }));
    }
    else if (req.url === '/') {
        res.setHeader('content-type', 'text/html');
        read('index.html').pipe(hyperstream({
            '#cmd': read('cmd.txt')
        })).pipe(res);
    }
    else est(req, res);
});
server.listen(argv.port);

function loadFile (hash, res) {
    var r = store.createReadStream({ key: hash });
    res.setHeader('max-age', Math.floor(60*60*24*365.25*100));
    res.setHeader('content-type', 'text/html');
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
}

function saveFile (cb) {
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
    var w = store.createWriteStream();
    w.on('error', cb);
    w.on('finish', function () {
        db.batch([
            {
                type: 'put',
                key: 'recent!' + lexi.pack(Date.now()) + '!' + w.key,
                value: {
                    addr: req.remoteAddress,
                    xaddr: req.headers['x-forwarded-for']
                }
            },
            {
                type: 'put',
                key: 'blob!' + w.key,
                value: { size: bytes }
            }
        ]);
        db.put(key, doc, function (err) {
            if (err) cb(err)
            else cb(null, w.key)
        });
    });
    tr.pipe(w);
    return tr;
}

function read (file) {
    return fs.createReadStream(path.join(__dirname, '../static', file));
}
