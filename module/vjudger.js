const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account');
const UVaJudger_module = require('./uva_judge_module');
const Juder_module = require('./judge_module');

class Vjudge_daemon {
    constructor(config, oj_name) {
        if (oj_name === "uva") {
            const daemon = new UVaJudger_module(config, oj_name);
            daemon.start(config['proxy']);
        }
        else {
            const daemon = new Juder_module(config, oj_name);
            daemon.start(config['proxy']);
        }
    }

}

module.exports = Vjudge_daemon;
/*function (config,oj_name) {
const ojmodule=require("./include/"+oj_name+"_module");
mysql = new mysql_module(config);
const loop_function = async function () {
    mysql.query("select * from (select * from vjudge_solution where runner_id='0' and result='0' and oj_name='"+oj_name.toUpperCase()+"')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (rows) {
        if (rows.length > 0) {
            logger.info(rows.length+" code(s) in queue.Judging");
            for (i = 0; i < rows.length && account.length > 0; ++i) {
                const solution = {
                    sid: rows[i]['solution_id'],
                    pid: rows[i]['problem_id'],
                    language: rows[i]['language'],
                    code: rows[i]['source']
                };
                const cur_account=account.shift();
                mysql.query("update vjudge_solution set result=?,judger=? where solution_id=?", [14,ojmodule.formatAccount(cur_account),rows[i]['solution_id']]);
                const judger = new Judger(config, cur_account, proxy,oj_name);
                judger.run(solution);
            }
        }
    });
};


async function runner() {
    await loop_function();
}

this.start = function (_proxy) {
    if (_proxy !== 'none')
        proxy = _proxy;
    const account_config = config['login'][oj_name];
    for (i in account_config) {
        this.account.push(account_config[i]);
    }
    runner();
    this.timer = setInterval(runner, 3000);
};
this.stop = function () {
    clearInterval(this.timer);
}
};
*/