const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
log4js.connectLogger(logger, {level: 'info'});
const UVaJudger = require('./uvajudger');
let account = require('./include/account');
const Vjudge_daemon = require('judge_module');

class uva_judge_daemon extends Vjudge_daemon {
    constructor(config, oj_name) {
        super(config, oj_name);
    }

    start(_proxy) {
        if (_proxy !== 'none')
            this.proxy = _proxy;
        this.precheck();
        const account_config = this.config['login'][this.oj_name];
        const len = account_config.length;
        account[this.oj_name] = [];
        for (let i = 0; i < len; ++i) {
            account[this.oj_name].push(new UVaJudger(this.config, account_config[i], this.proxy, this.oj_name))
        }
        this.loop_function();
        this.timer = setInterval(() => {
            this.loop_function()
        }, 1000);
    }
}

module.exports = uva_judge_daemon;