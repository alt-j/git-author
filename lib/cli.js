var pathJoin = require('path').join;
var program = require('commander');
var Processor = require('./git-author');

function collect(val, memo) {
    memo.push(val);
    return memo;
}

program
    .version('0.0.1')
    .option('-p, --path <path>', 'Path to file or directory with files')
    .option('-i, --includes [pattern]', 'Files names pattern', collect, [])
    .option('-e, --excludes [pattern]', 'Files names pattern', collect, [])
    .option('-a, --aliases <config>', 'JSON config file with aliases of authors')
    .parse(process.argv);

var aliasesOfAuthors = {};
if (program.aliases) {
    aliasesOfAuthors = require(pathJoin(process.cwd(), program.aliases));
}

var processor = new Processor({
    includes: program.includes || [],
    excludes: program.excludes || [],
    aliasesOfAuthors: aliasesOfAuthors
});

if (program.path) {
    processor.process(program.path)
        .then(function () {
                console.log('path processed');
        }, function (error) {
                console.log(error);
        });
}
