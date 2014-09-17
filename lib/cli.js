var program = require('commander');
var Processor = require('./git-author');

function collect(val, memo) {
    memo.push(val);
    return memo;
}

program
    .version('0.0.1')
    .option('-p, --path <path>', 'Path to file or directory with files')
    .option('-e, --extensions [extension]', 'Files extensions', collect, [])
    .parse(process.argv);
var processor = new Processor({
    extensions: program.extensions
});

if (program.path) {
    processor.process(program.path)
        .then(function () {
                console.log('path processed');
        }, function (error) {
                console.log(error);
        });
}
