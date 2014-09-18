var exec = require('child_process').exec;
var pathJoin = require('path').join;

var fs = require('vow-fs');
var vow = require('vow');

var Processor = function (options) {
    this.options = {
        excludes: (options.excludes || [])
            .map(function (exclude) {
                return new RegExp(exclude);
            }),
        includes: (options.includes || [])
            .map(function (include) {
                return new RegExp(include);
            }),
        minLength: options.minLength || 15,
        aliasesOfAuthors: options.aliasesOfAuthors || {}
    };
};

Processor.prototype.process = function (path) {
    var deferred = vow.defer();

    fs.isDir(path)
        .then(function (isDir) {
            var promise = isDir ?
                this._processDirectory(path) :
                this._processFile(path);

            promise.then(function () {
                deferred.resolve();
            }, function (error) {
                deferred.reject(error);
            });
        }, function (error) {
            deferred.reject('Can\'t read \'' + path + '\': ' + error);
        }, this);

    return deferred.promise();
};

Processor.prototype._processDirectory = function (path) {
    var deferred = vow.defer();

    fs.listDir(path)
        .then(function (list) {
            var promises = [];
            for (var i = 0, length = list.length; i < length; i++) {
                promises.push(this.process(pathJoin(path, list[i])));
            }
            vow.all(promises).then(function () {
                deferred.resolve();
            }, function (error) {
                deferred.reject(error);
            });
        }, function (error) {
            deferred.reject('Can\'t read \'' + path + '\': ' + error);
        }, this);

    return deferred.promise();
};

Processor.prototype._processFile = function (path) {
    var deferred = vow.defer();
    var options = this.options;
    var onError = function (error) {
        deferred.reject('Can\'t process file \'' + path + '\': ' + error);
    };

    if (path && this._checkPattern(path)) {
        exec('git blame -M -w --date short --show-name ' + path, function (error, stdout, stderr) {
            if (error || stderr) {
                deferred.reject(error || stderr);
            } else if (stdout.split('\n').length >= options.minLength) {
                var authors = {};
                var content = [];

                stdout.split('\n')
                    .forEach(function (line) {
                        var match = line.match(/^[^\(]+\((.*)\s+\d{4}-\d{2}-\d{2}\s+\d+\)\s(.*)$/);
                        if (match) {
                            if (match[2].trim()) {
                                var author = match[1].trim();
                                author = options.aliasesOfAuthors[author] || author;
                                authors[author] = authors[author] ? authors[author] + 1 : 1;
                            }
                            content.push(match[2]);
                        }
                    });

                var topAuthors = pickTopAuthors(authors);
                topAuthors = '/**\n * @author ' + topAuthors.join('\n * @author ') + '\n */\n';

                var authorsPattern = /^\/\*\*\n(\s\*\s@author[^\n]+\n)+\s\*\/\n\n/;
                content = content.join('\n');
                if (authorsPattern.test(content)) {
                    content = content.replace(authorsPattern, '');
                }
                content = topAuthors + '\n' + content + '\n';

                fs.write(path, content, {encoding: 'utf8'})
                    .then(function () {
                        deferred.resolve();
                    }, onError);
            } else {
                deferred.resolve();
            }
        });
    } else {
        deferred.resolve();
    }

    return deferred.promise();
};

Processor.prototype._checkPattern = function (path) {
    var includes = this.options.includes;
    var excludes = this.options.excludes;

    var fileName = path.split('/').pop();

    if (includes.length == 0 && excludes.length == 0) {
        return true;
    } else {
        for (var i = 0, length = excludes.length; i < length; i++) {
            if (excludes[i].test(fileName)) {
                return false;
            }
        }
        for (var i = 0, length = includes.length; i < length; i++) {
            if (includes[i].test(fileName)) {
                return true;
            }
        }
    }
    return false;
};

function pickTopAuthors(authors) {
    var length = Object.keys(authors)
        .reduce(function (acc, author) {
            return acc + authors[author];
        }, 0);
    var topAuthors = Object.keys(authors)
        .filter(function (author) {
            if (authors[author] / length > 0.4) {
                return true;
            }
            return false;
        });
    if (topAuthors.length == 0) {
        topAuthors = Object.keys(authors)
            .sort(function (author1, author2) {
                return authors[author2] - authors[author1];
            })
            .slice(0, 2);
    }
    return topAuthors;
}

module.exports = Processor;
