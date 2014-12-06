var fs = require('fs');
var through = require('through2');
var duplexer = require('duplexer2');
var lexi = require('lexicographic-integer');
var hyperspace = require('hyperspace');
var strftime = require('strftime');
var split = require('../lib/split.js');

module.exports = function (addr) {
    var input = through.obj(), output = through();
    fs.readFile(__dirname + '/recent.html', function (err, html) {
        input.pipe(hyperspace(html, function (row) {
            var parts = row.key.split('!');
            return {
                '.hash': {
                    href: 'http://' + split(parts[2]) + '.' + addr,
                    _text: parts[2]
                },
                '.time': strftime('%F %T', new Date(lexi.unpack(parts[1])))
            };
        })).pipe(output);
    });
    return duplexer(input, output);
};
