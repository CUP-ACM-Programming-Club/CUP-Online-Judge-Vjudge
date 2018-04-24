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

class Judger extends eventEmitter {
    constructor(config, account, proxy, oj_name) {
        super();
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config['url'][oj_name];
        this.oj_name = oj_name;
        this.cookie = "";
        this.ojmodule = require("./include/" + this.oj_name + "_module");
        this.finished = false;
        this.agent = superagent.agent();
        logger.info(`constructed Judger`);
    }

    proxy_check(agent_module, cookie = "") {
        agent_module = agent_module.set(this.config.browser);
        if (cookie && cookie.length > 0) agent_module = agent_module.set("Cookie", cookie);
        if (this.proxy.length > 4) {
            return agent_module.proxy(this.proxy);
        }
        else {
            return agent_module;
        }
    }

    static valid_judge(err, response) {
        if (err || response.text.indexOf("wwwcache1.hdu.edu.cn") !== -1) {
            logger.warn(err || "Server cannot work");
            return false;
        }
        else {
            return true;
            //this.login();
        }
    }

    async record(rows) {
        let accpeted = (parseInt(rows[0]['accepted']) + 1) || 1;
        try {
            query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid, this.oj_name.toUpperCase()]);
        }
        catch (e) {
            this.record(rows);
        }
    }

    async connect(err, response) {
        if (err) {
            logger.fatal(err);
        }
        this.updateTimeout();
        try {
            const sqlArr = this.ojmodule.format(response, this.sid);
            if (isNaN(sqlArr[0])) {
                this.updateStatus(this.pid);
                return;
            }
            const status = sqlArr[1];
            this.result = sqlArr;
            this.cleanTimeout();
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
            this.finished = true;
            this.emit("finish");
        }
        catch (e) {
            logger.fatal(e);
            this.error();
        }
    };

    updateStatus() {
        if (typeof this.runner_id === "number") {
            this.emit("finish");
            this.finished = true;
            query(`update vjudge_solution set runner_id = ? where 
            solution_id = ?`, [this.runner_id, this.sid]);
        }
        else {
            this.proxy_check(this.agent.get(this.ojmodule.updateurl(this.pid, this.account)))
                .end((err, response) => {
                    this.connect(err, response);
                });
        }
    };

    async submitAction() {
        logger.info("PID:" + this.pid + " come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code) {
        this.updateTimeout();
        const postmsg = this.ojmodule.post_format(pid, lang, code);
        this.proxy_check(this.agent.post(this.url.post_url))
            .send(postmsg)
            .end((err, response) => {
                let runner_id = this.ojmodule.validSubmit(response);
                if (runner_id) {
                    if (typeof runner_id === "number") {
                        this.runner_id = runner_id;
                    }
                    this.updateTimeout();
                    this.submitAction(err, response)
                }
                else {
                    query("UPDATE vjudge_solution set result=15 where solution_id=?", [this.sid]);
                    this.emit("finish");
                }
            });
    };

    loginAction(err, response) {
        if (err) {
            logger.fatal(err);
        }
        try {
            this.submitAnswer(this.pid, this.language, this.code);
        }
        catch (e) {
            logger.fatal(e);
            this.error();
        }
    }

    async error() {
        try {
            await query("update vjudge_solution set result='0' and runner_id='0' where solution_id=?", [this.sid]);
        }
        catch (e) {
            await this.error();
        }
        this.emit("finish");
    }

    getAccount() {
        return this.account;
    }

    cleanTimeout() {
        if (this.setTimeout) {
            clearTimeout(this.setTimeout);
        }
    }

    updateTimeout() {
        if (this.setTimeout) {
            clearTimeout(this.setTimeout);
        }
        setTimeout(() => {
            this.setTimeout = true;
            if (!this.finished) {
                this.error();
            }
        }, 1000 * 60 * 2);
    }

    login(cookie, res) {
        if (!this.setTimeout) {
            setTimeout(() => {
                this.setTimeout = true;
                if (!this.finished) {
                    this.error();
                }
            }, 1000 * 60 * 2);
        }
        this.account["B1"] = "login";
        this.proxy_check(superagent.post(this.url.login_url), cookie)
            .send(this.account)
            //  .set("Cookie",cookie)
            .end((err, response) => {
                //console.log(this);
                //console.log(response.text);
                //console.log(this.account)
                if (res)
                    this.agent._saveCookies(res);
                if (response.headers["set-cookie"] && response.headers["set-cookie"].length > 0)
                    this.agent._saveCookies(response);
                //        console.log(response.text);
                this.loginAction(err, response);
            });
    };

    async website_valid_check() {
        let valid = true;
        if (this.proxy.length > 4)
            await superagent.get(this.url.url).set(this.config['browser']).proxy(this.proxy).end((err, response) => {
                valid = Judger.valid_judge(err, response);
            });
        else
            await superagent.get(this.url.url).set(this.config['browser']).end((err, response) => {
                valid = Judger.valid_judge(err, response);
            });
        return valid;
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.finished = false;
        //console.log(solution);
        logger.info(`run judger for sid:${this.sid}`);
        console.log(`run judger for sid:${this.sid}`);
        //this.website_valid_check();
        this.login();
    }
}

module.exports = Judger;
