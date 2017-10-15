const spawn = require('child_process').spawn;
module.exports = function () {
    const run = function () {
        const online = spawn('ps', ['-ef']);
        online.stdout.on('data', function (data) {
            const receive = data.toString();
            if (!(receive.match('node app.js') && receive.match('node app.js').toString()==='node app.js')) {
                const restart = spawn('screen', ['node','/root/ws/app.js']);
                restart.stdout.on('data',function (data) {
                    console.log(data);
                });
                restart.on('exit',function (code,signal) {
                    console.log('app.js exited.exit code:'+code);
                })
            }
        });

        online.on('exit', function (code, signal) {
            console.log('exit:' + code);
        });
    };
    this.start = function () {
        run();
        this.timer = setInterval(run, 1000 * 60 * 30);

    };
    this.stop = function () {
        clearInterval(this.timer);
    }
};