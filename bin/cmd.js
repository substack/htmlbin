#!/usr/bin/env node

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: {
        p: 'port',
        s: 'sslport',
        u: 'uid',
        g: 'gid'
    },
    default: {
        port: process.getuid() ? 8000 : 80,
        sslport: process.getuid() ? 8443 : 443,
        dir: './blob'
    }
});
var alloc = require('tcp-bind');
var fd = {
    http: alloc(argv.port),
    sslport: argv.key || argv.pfx ? alloc(argv.sslport) : null
};

if (argv.gid) process.setgid(argv.gid);
if (argv.uid) process.setuid(argv.uid);

var http = require('http');
var https = require('https');
var fs = require('fs');

var level = require('level');
var db = level('./db', { valueEncoding: 'json' });

var blob = require('content-addressable-blob-store');
var store = blob(argv);
var handle = require('../')(db, store);

if (argv.ssl) {
    http.createServer(function (req, res) {
        res.statusCode = 301;
        res.setHeader('location', 'https://' + res.headers.host);
        res.end();
    }).listen(argv.port);
    
    var opts = {};
    if (argv.key) opts.key = fs.readFileSync(argv.key);
    if (argv.cert) opts.cert = fs.readFileSync(argv.cert);
    if (argv.pfx) opts.pfx = fs.readFileSync(argv.pfx);
    
    var server = https.createServer(opts, handle);
    server.listen({ fd: fd.https }, function () {
        console.log('https://localhost:' + server.address().port);
    });
}
else {
    var server = http.createServer(handle);
    server.listen({ fd: fd.http }, function () {
        console.log('http://localhost:' + server.address().port);
    });
}
