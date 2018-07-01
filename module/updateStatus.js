const superagent = require('superagent');
require('superagent-proxy')(superagent);
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const query = require('./include/mysql_module');
const eventEmitter = require("events").EventEmitter;
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account');
const updater = require('./include/userupdater');

class Updater {
    constructor(oj_name, runner_id, solution_id, pid, account) {
        this.proxy = global.config.proxy;
        this.config = global.config;
        this.url = this.config.url[oj_name];
        this.oj_name = oj_name;
        this.account = account;
        this.runner_id = runner_id;
        this.sid = this.solution_id = solution_id;
        this.ojmodule = require("./include/" + this.oj_name.toLowerCase() + "_module");
        this.agent = superagent.agent();
        this.pid = pid;
        logger.info(`constructed Updater`);
        this.updateStatus()
    }

    updateStatus() {
        this.proxy_check(this.agent.get(this.ojmodule.updateurl(this.pid, this.account, this.runner_id)))
            .end((err, response) => {
                this.connect(err, response);
            });
    };

    async record(rows) {
        //let accpeted = (parseInt(rows[0]['accepted']) + 1) || 1;
        try {
            query(`update vjudge_problem set accepted =
(select count(1) from vjudge_solution where vjudge_solution.problem_id= ?
and oj_name = ? and result = 4),
  submit = (select count(1) from vjudge_solution where vjudge_solution.problem_id = ?
  and oj_name = ?)
  where problem_id = ? and source = ?`,[this.pid,this.oj_name.toUpperCase(),this.pid,this.oj_name.toUpperCase(),this.pid,this.oj_name.toUpperCase()]);
           // query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid, this.oj_name.toUpperCase()]);
        }
        catch (e) {
            this.record(rows);
        }
    }

    async connect(err, response) {
        if (err) {
            logger.fatal(err);
        }
        try {
            const sqlArr = this.ojmodule.format(response, this.sid, this.runner_id);
            const status = sqlArr[1];
            this.result = sqlArr;
            query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr)
                .then(resolve => {
                }).catch(err => {
                logger.fatal("error:\nsqlArr");
                logger.fatal(sqlArr);
                logger.fatal(err)
            });
            if (status > 3) {
                updater(this.sid);
                if (status === 4) {
                    query("select accepted from vjudge_problem where problem_id=? and source=?", [this.pid, this.oj_name.toUpperCase()])
                        .then((rows) => {
                            this.record(rows);
                        }).catch((err) => {
                        logger.fatal("ERROR:select\n");
                        logger.fatal(err);
                        this.error();
                    });
                }
            }
            else {
                this.updateStatus();
            }
        }
        catch (e) {
            logger.fatal(e);
            this.error();
        }
    };

    proxy_check(agent_module) {
        agent_module = agent_module.set(this.config.browser);
        if (this.proxy.length > 4) {
            return agent_module.proxy(this.proxy);
        }
        else {
            return agent_module;
        }
    }
}

class UpdateManager {
    constructor() {
        setInterval(this.loop, 1500);
        UpdateManager.precheck().then().catch();
        this.loop();
    }

    static async precheck() {
        await query("update vjudge_solution set result = 'empty',ustatus = 0 where (result=14 or result < 4)");
    }

    loop() {
        query(`SELECT * FROM vjudge_solution where 
        (result < 4 or result = 14) and oj_name in ("HDU","POJ","UVA") and runner_id != 'empty' and ustatus = 0`)
            .then(rows => {
                for (let i of rows) {
                    //console.log(i);
                    const account = global.config.login[i.oj_name.toLowerCase()]
                        .find(_account => Object.values(_account).some(el => el === i.judger));
                    query(`update vjudge_solution set ustatus = 1 where solution_id = ?`,[i.solution_id]);
                    new Updater(i.oj_name, i.runner_id, i.solution_id, i.problem_id, account)
                }
            })
    }
}

module.exports = UpdateManager;
