const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
log4js.connectLogger(logger, {level: 'info'});
const Juder_module = require('./judge_module');

class Vjudge_daemon {
    constructor(config, oj_name) {
        this.daemon = new Juder_module(config, oj_name);
        this.daemon.start(config['proxy']);
    }
}

module.exports = Vjudge_daemon;