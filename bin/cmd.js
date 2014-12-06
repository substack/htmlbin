#!/usr/bin/env node

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: {
        p: 'port', s: 'sslport',
        u: 'uid', g: 'gid',
        d: 'datadir', r: 'remote',
        h: 'help'
    },
    default: {
        port: process.getuid() ? 8000 : 80,
        sslport: process.getuid() ? 8443 : 443,
        datadir: './htmlbin-data'
    }
});
var alloc = require('tcp-bind');
if (argv._[0] === 'server') {
    var fd = {
        http: alloc(argv.port),
        https: argv.key || argv.pfx ? alloc(argv.sslport) : null
    };
    if (argv.gid) process.setgid(argv.gid);
    if (argv.uid) process.setuid(argv.uid);
}

var http = require('http');
var https = require('https');
var mkdirp = require('mkdirp');
var url = require('url');
var defined = require('defined');
var fs = require('fs');
var path = require('path');

if (argv._[0] === 'help' || argv.help) {
    var r = fs.createReadStream(path.join(__dirname, 'usage.txt'));
    r.pipe(process.stdout);
}
else if (argv._[0] === 'server') {
    mkdirp.sync(argv.datadir);
    var level = require('level');
    var db = level(path.join(argv.datadir, 'db'), { valueEncoding: 'json' });
    
    var blob = require('content-addressable-blob-store');
    var store = blob({ path: path.join(argv.datadir, 'blob') });
    var handle = require('../')(db, store);
    
    if (fd.https) {
        if (fd.http && argv.port === 0) {
            http.createServer(function (req, res) {
                var u = 'https://' + res.headers.host + req.url;
                res.statusCode = 301;
                res.setHeader('location', u);
                res.end();
            }).listen(argv.port);
        }
        else if (fd.http) {
            http.createServer(handle).listen({ fd: fd.http })
        }
        
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
}
else if (argv._[0] === 'upload' || argv._[0] === undefined) {
    var input = argv.infile
        ? fs.createReadStream(argv.infile)
        : process.stdin
    ;
    var config = getConfig();
    var remote = defined(argv.remote, config.remote);
    var u = url.parse(remote);
    var r = input.pipe(http.request({
        method: 'PUT',
        host: u.hostname,
        port: u.port,
        path: u.path
    }));
    r.on('response', function (res) {
        if (!/^2/.test(res.statusCode)) {
            console.error('error code ' + res.statusCode);
            res.pipe(process.stderr);
            res.on('end', function () { process.exit(1) });
        }
        else res.pipe(process.stdout);
    });
}
else if (argv._[0] === 'config' && argv._[1] === 'get') {
    console.log(getConfig()[argv._[2]]);
}
else if (argv._[0] === 'config' && argv._[1] === 'set') {
    var config = getConfig();
    config[argv._[2]] = argv._[3];
    setConfig(config);
}
else if (argv._[0] === 'config' && argv._[1] === 'list') {
    console.log(JSON.stringify(getConfig(), null, 2));
}
else if (argv._[0] === 'config' && argv._[1] === 'rm') {
    var config = getConfig();
    delete config[argv._[2]];
    setConfig(config);
}

function getConfig () {
    var file = configPath();
    mkdirp.sync(path.dirname(file));
    var config;
    try { config = require(file) }
    catch (err) { config = {} }
    if (!config.remote) config.remote = 'https://htmlb.in';
    return config;
}

function configPath () {
    var home = defined(process.env.HOME, process.env.USERPROFILE);
    return path.join(home, '.config/htmlbin.json');
}

function setConfig (config) {
    var file = configPath();
    mkdirp.sync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
}
