const superagent = require('superagent');
require('superagent-proxy')(superagent);
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const query = require('./include/mysql_module');
log4js.connectLogger(logger, {level: 'info'});

let account = require('./include/account');
const judger_list={
    hdu:"",
    poj:"",
    uva:"uva",
    jsk:"jsk",
    vijos:"vijos",
    bzoj:"bzoj"
};
class Vjudge_daemon {
    constructor(config, oj_name) {
        this.config = config;
        this.oj_name = oj_name;
        this.ojmodule = require("./include/" + oj_name + "_module");
        this.judger = require(`./${judger_list[oj_name]}judger`);
    }

    loop_function() {
        if (account[this.oj_name].length > 0) {
            query(`select * from (select * from vjudge_solution where result='0' and oj_name='${this.oj_name.toUpperCase()}')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id `)
                .then((rows) => {
                    if (rows.length > 0) {
                        logger.info(rows.length + " code(s) in queue.Judging");
                        for (let i = 0; i < rows.length && account[this.oj_name].length > 0; ++i) {
                            logger.info(`In judging loop ${i}`);
                            const solution = {
                                sid: rows[i]['solution_id'],
                                pid: rows[i]['problem_id'],
                                language: rows[i]['language'],
                                code: rows[i]['source']
                            };
                            if (account[this.oj_name].length > 0) {
                                logger.info(`catch using account ${account[this.oj_name]}`);
                                const cur_judger = account[this.oj_name].shift();
                                query("update vjudge_solution set result=?,judger=? where solution_id=?", [14, this.ojmodule.formatAccount(cur_judger.getAccount()), rows[i]['solution_id']]);
                                cur_judger.run(solution);
                            }
                        }
                    }
                })
                .catch((err) => {
                    console.log(err);
                    logger.fatal(err);
                });
        }
    }

    async precheck() {
        // TODO:automatically crawling successful submission's result
        await query("update vjudge_solution set result=0  where (result=14 or result < 4) and oj_name='" + this.oj_name.toUpperCase() + "'");
    }

    async start(_proxy) {
        if (_proxy !== 'none')
            this.proxy = _proxy;
        else{
            this.proxy = "";
        }
        await this.precheck();
        const account_config = this.config['login'][this.oj_name];
        const len = account_config.length;
        account[this.oj_name] = [];
        for (let i = 0; i < len; ++i) {
            let judger = new this.judger(this.config, account_config[i], this.proxy, this.oj_name);
            judger.on("finish", () => {
                account[this.oj_name].push(judger);
            });
            account[this.oj_name].push(judger);
        }
        this.loop_function();
        this.timer = setInterval(() => {
            this.loop_function()
        }, 1000);
    }

    stop() {
        clearInterval(this.timer);
    }
}

module.exports = Vjudge_daemon;