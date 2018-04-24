const superagent = require("superagent");
require("superagent-proxy")(superagent);
const cheerio = require("cheerio");
const agent = superagent.agent();
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
const eventEmitter = require("events").EventEmitter;
const updater = require('./include/userupdater');
log4js.connectLogger(logger, {level: 'info'});

class Judger extends eventEmitter {
    constructor(config, account, proxy, oj_name) {
        super();
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config.url["vijos"];
        this.oj_name = oj_name;
        this.agent = agent;
        this.cookie = "";
        this.ojmodule = require(`./include/${this.oj_name}_module`);
        this.finished = false;
        logger.info(`constructed ${this.oj_name} Judger`);
    }

    proxy_check(agent_module) {
        agent_module = agent_module.set(this.config.browser);
        if (this.proxy.length > 4) {
            return agent_module.proxy(this.proxy);
        }
        else {
            return agent_module;
        }
    }

    record(rows) {
        let accepted = (parseInt(rows[0]['accepted']) + 1) || 1;
        try {
            query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accepted, this.pid, this.oj_name.toUpperCase()]);
        }
        catch (e) {
            this.record(rows);
        }
    }

    update(submit_id) {
        const that = this;
        this.proxy_check(this.agent.get(that.ojmodule.formatStatusUrl(that.pid, this.account.uname)))
            .end((err, response) => {
                if (!err) {
                    clearTimeout(that.setTimeout);
                    setTimeout(() => {
                        that.setTimeout = true;
                        if (!that.finished) {
                            that.error()
                        }
                    }, 1000 * 60 * 2);
                }
                const result = that.ojmodule.formatResult(response.text, submit_id, that.sid);
                query(`update vjudge_solution set runner_id = ?,
                result = ?,time = ?,memory = ? where solution_id = ?`,
                    result)
                    .then(() => {
                    })
                    .catch((err) => {
                        console.log(err);
                    });
                if (result.status > 3) {
                    updater(that.sid);
                    that.finished = true;
                    that.emit("finish");
                    if (result.status === 4) {
                        query(`select accepted from vjudge_problem 
                        where problem_id = ? and source = ?`,
                            [this.pid, this.oj_name.toUpperCase()])
                            .then((rows) => {
                                that.record(rows);
                            })
                            .catch((err) => {
                                logger.fatal(err);
                            })
                    }
                }
                else {
                    sleep(500)
                        .then(that.update(that.ojmodule.formatSubmitId(submit_id[0])));
                }
            })
    }

    login() {
        const that = this;
        this.proxy_check(this.agent.post(this.url.login_url))
            .send(this.account)
            .end(() => {
                that.submit();
            });
    }

    submit() {
        const that = this;
        if (!this.setTimeout) {
            setTimeout(() => {
                that.setTimeout = true;
                if (!that.finished) {
                    that.error()
                }
            }, 1000 * 60 * 2);
        }
        const url = this.ojmodule.formatSubmitUrl(this.pid);
        this.proxy_check(this.agent.get(url))
            .end((err, response) => {
                if (response.text.indexOf(that.account.uname) === -1) {
                    that.login();
                }
                else {
                    const $ = cheerio.load(response.text);
                    const csrf_token = $("input").eq(0).attr("value");
                    const submit_obj = {
                        lang: that.ojmodule.formatLanguage(this.language),
                        code: that.code,
                        csrf_token: csrf_token
                    };
                    that.proxy_check(this.agent.post(url))
                        .send(submit_obj)
                        .end((err, response) => {
                            sleep(500)
                                .then(() => {
                                    that.update(that.ojmodule.formatSubmitId(response.redirects[0]));
                                    return;
                                })
                        });
                }
            })
    }

    getAccount() {
        return this.account;
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.finished = false;
        logger.info(`run judger for sid:${this.sid}`);
        this.submit();
    }
}

module.exports = Judger;

/*
const user = {
    uname: "",
    password: ""
};
const config = {
    "User-this.agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36"
    ,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
};

const submit_data = {
    lang: "",
    code: ``
};

(async () => {
    await new Promise((resolve => {
        this.agent.post("https://vijos.org/d/newbzoj/login")
            .send(user)
            .set(config)
            .end((err, response) => {
                resolve();
            });
    }));
    const response = await new Promise(resolve => {
        this.agent.get("https://vijos.org/d/newbzoj/p/590c8d0dd3d8a13210993708/submit")
            .set(config)
            .end((err, response) => {
                resolve(response);
            })
    });
    const $ = cheerio.load(response.text);
    submit_data["csrf_token"] = $("input").eq(0).attr("value");
    //console.log($("input").eq(0).attr("value"));
    //console.log(response.text);
    await new Promise(resolve => {
        this.agent.post("https://vijos.org/d/newbzoj/p/590c8d0dd3d8a13210993708/submit")
            .set(config)
            .send(submit_data)
            .end((err, response) => {
                console.log(response);
                console.log(response.headers);
                resolve();
            })
    });
    return;
})();
*/
