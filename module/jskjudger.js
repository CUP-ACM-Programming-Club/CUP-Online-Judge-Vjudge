const superagent = require('superagent');
require('superagent-proxy')(superagent);
const agent = superagent.agent();
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
const eventEmitter = require("events").EventEmitter;
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account');
const md5 = require("md5");

class Judger extends eventEmitter {
    constructor(config, account, proxy, oj_name) {
        super();
        this.proxy = proxy;
        this.account = account;
        this.account.pwd = md5(account["password"]);
        this.config = config;
        this.url = config['url'][oj_name];
        this.oj_name = oj_name;
        this.cookie = "";
        this.ojmodule = require("./include/" + this.oj_name + "_module");
        this.finished = false;
        logger.info(`constructed Judger`);
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
        try {
            const sqlArr = this.ojmodule.format(response, this.sid);
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
                this.finished = true;
                this.emit("finish");
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
                await sleep(500);
                this.updateStatus(this.pid);
            }
        }
        catch (e) {
            logger.fatal(e);
            account[this.oj_name].push(this);
            this.error();
        }
    };

    async updateStatus(pid,_response) {
        const post_id = {
            id:pid
        };
        if(this.proxy.length>4){
            await new Promise((resolve => {
                agent.post(this.ojmodule.updateurl(_response))
                    .proxy(this.proxy)
                    .set("User-Agent",this.config["useragent"])
                    .send(post_id)
                    .set("X-XSRF-TOKEN",this.xsrf)
                    .end((err,response)=>{
                        this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                        const receive_data = JSON.parse(response.text);
                        const status = this.ojmodule.format(receive_data);
                        query("update vjudge_solution set runner_id=?,result=?,time=0,memory=0 where solution_id=?", [JSON.parse(_response.text).data,status,this.sid])
                            .then(resolve => {
                            }).catch(err => {
                            logger.fatal("error:\nsqlArr");
                            console.log([JSON.parse(_response.text).data,status,this.sid]);
                            console.log(receive_data);
                            logger.fatal(err)
                        });
                        if(status>3){
                            this.finished = true;
                            this.emit("finish");
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
                        else{
                            this.updateStatus(pid,_response);
                        }
                        resolve();
                    })
            }));

        }
        else{
            await new Promise((resolve => {
                agent.post(this.ojmodule.updateurl(_response))
                    .set("User-Agent",this.config["useragent"])
                    .send(post_id)
                    .set("X-XSRF-TOKEN",this.xsrf)
                    .end((err,response)=>{
                        this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                        const receive_data = JSON.parse(response.text);
                        const status = this.ojmodule.format(receive_data);
                        query("update vjudge_solution set runner_id=?,result=?,time=0,memory=0 where solution_id=?", [JSON.parse(_response.text).data,status,this.sid])
                            .then(resolve => {
                            }).catch(err => {
                            logger.fatal("error:\nsqlArr");
                            logger.fatal(sqlArr);
                            logger.fatal(err)
                        });
                        if(status>3){
                            this.finished = true;
                            this.emit("finish");
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
                        else{
                            this.updateStatus(pid,_response);
                        }
                        resolve();
                    })
            }));
        }
    };

    async submitAction(response) {
        await sleep(500);
        logger.info("PID:" + this.pid + " come to update");
        this.updateStatus(this.pid,response);
    };

    submitAnswer(pid, lang, code) {
        const postmsg = this.ojmodule.post_format(pid, lang, code);
        if (this.proxy.length > 4) {
            agent.post(this.url.post_url)
                .set("User-Agent",this.config["useragent"])
                .proxy(this.proxy)
                .send(postmsg)
                .set("X-XSRF-TOKEN",this.xsrf)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.submitAction(response);
                })
        }
        else {
            agent.post(this.url.post_url)
                .set("User-Agent",this.config["useragent"])
                .send(postmsg)
                .set("X-XSRF-TOKEN",this.xsrf)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.submitAction(response);
                })
        }
    };

    loginAction(err, response) {
        if (err) {
            logger.fatal(err);
        }
        if (response.text.indexOf("我的主页") === -1) {
            this.error();
            logger.fatal(`${this.oj_name} Judger login failed`);
            return;
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

    login() {
        if (!this.setTimeout) {
            setTimeout(() => {
                this.setTimeout = true;
                if (!this.finished) {
                    this.error();
                }
            }, 1000 * 60 * 2);
        }
        if (this.proxy.length > 4) {
            agent.post(this.url.login_url)
                .set("User-Agent",this.config["useragent"])
                .proxy(this.proxy)
                .set("X-XSRF-TOKEN",this.xsrf)
                .send(this.account)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.loginAction(err, response);
                })
        }
        else {
            agent.post(this.url.login_url)
                .set("User-Agent",this.config["useragent"])
                .send(this.account)
                .set("X-XSRF-TOKEN",this.xsrf)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.loginAction(err, response);
                })
        }
    };

    async check_logined() {
        if (this.proxy.length > 4) {
            agent.get(this.url.url)
                .set("User-Agent",this.config["useragent"])
                .set("X-XSRF-TOKEN", this.xsrf)
                .proxy(this.proxy)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    if (response.text.indexOf("我的主页") !== -1) {
                        this.submitAnswer(this.pid, this.language, this.code);
                    }
                    else {
                        this.login();
                    }
                })
        }
        else {
            agent.get(this.url.url)
                .set("User-Agent",this.config["useragent"])
                .set("X-XSRF-TOKEN", this.xsrf)
                .end((err, response) => {
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    if (response.text.indexOf("我的主页") !== -1) {
                        this.submitAnswer(this.pid, this.language, this.code);
                    }
                    else {
                        this.login();
                    }
                })
        }
    }

    prelogin(){
        if(this.proxy.length>4){
            agent.get(this.url.url)
                .proxy(this.proxy)
                .set("User-Agent",this.config["useragent"])
                .end((err,response)=>{
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.login();
                })
        }
        else{
            agent.get(this.url.url)
                .set("User-Agent",this.config["useragent"])
                .end((err,response)=>{
                    this.xsrf = this.ojmodule.findxsrf(response.headers["set-cookie"]) || this.xsrf;
                    this.login();
                })
        }

    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.finished = false;
        logger.info(`run judger for sid:${this.sid}`);
        if (this.xsrf && this.xsrf.length > 0) {
            this.check_logined();
        }
        else {
            this.prelogin();
        }
    }
}

module.exports = Judger;