const superagent = require('superagent');
require('superagent-proxy')(superagent);
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account');

class Judger {
    constructor(config, account, proxy, oj_name) {
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config['url'][oj_name];
        this.oj_name = oj_name;
        this.cookie = "";
        this.ojmodule = require("./include/" + this.oj_name + "_module");
        this.finished = false;
    }

    record(rows) {
        let accpeted = parseInt(rows[0]['accepted']) + 1;
        query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid, this.oj_name.toUpperCase()]);
    }

    async connect(err, response) {
        const sqlArr = this.ojmodule.format(response, this.sid);
        const status = sqlArr[1];
        query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr);
        if (status > 3) {
            account[this.oj_name].push(this.account);
            if (status === 4) {
                query("select accepted from vjudge_problem where problem_id=? and source=?", [this.pid, this.oj_name.toUpperCase()], (rows) => {
                    this.record(rows)
                });
            }
        }
        else {
            await sleep(2000);
            this.updateStatus(this.pid, this.sid, this.cookie);
        }
    };

    updateStatus(pid, cookie) {
        if (this.proxy.length > 4)
            superagent.get(this.ojmodule.updateurl(pid, this.account)).set("Cookie", cookie).proxy(this.proxy).set(this.config['browser']).end((err, response) => {
                this.connect(err, response)
            });
        else
            superagent.get(this.ojmodule.updateurl(pid, this.account)).set("Cookie", cookie).set(this.config['browser']).end((err, response) => {
                this.connect(err, response)
            });
    };

    async submitAction() {
        await sleep(2000);
        logger.info("PID:" + this.pid + " come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code, cookie) {
        const postmsg = this.ojmodule.post_format(pid, lang, code);
        if (this.proxy.length > 4)
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(postmsg).end((err, response) => {
                this.submitAction(err, response)
            });
        else
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).send(postmsg).end((err, response) => {
                this.submitAction(err, response)
            });
    };

    loginAction(err, response, cookie) {
        if (err) {
            logger.fatal(err);
        }
        try {
            this.submitAnswer(this.pid, this.language, this.code, cookie);
        }
        catch (e) {
            logger.fatal(e);
            this.error();
        }
    }

    error() {
        query("update vjudge_solution set result='0' where solution_id=?", [this.sid]);
        account[this.oj_name].push(this.account);
    }

    login() {
        setTimeout(() => {
            if (!this.finished) {
                this.error();
            }
        }, 1000 * 60 * 2);
        if (this.proxy.length > 4)
            superagent.post(this.url.login_url).set(this.config['browser']).proxy(this.proxy).send(this.account).end((err, response) => {
                this.loginAction(err, response, response.headers["set-cookie"]);
            });
        else
            superagent.post(this.url.login_url).set(this.config['browser']).send(this.account).end((err, response) => {
                this.loginAction(err, response, response.headers["set-cookie"]);
            });
    };

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.login();
    }
}

module.exports = Judger;