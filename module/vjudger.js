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

let account = {};

class Judger {
    constructor(config, account, proxy,oj_name) {
        // console.log(account);
        // console.log(proxy);
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config['url'][oj_name];
        this.oj_name=oj_name;
        this.cookie="";
        this.ojmodule=require("./include/"+this.oj_name+"_module");
    }

    record(rows){
        let accpeted = parseInt(rows[0]['accepted']) + 1;
        query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid, this.oj_name.toUpperCase()]);
    }

    async connect(err, response) {
        const sqlArr = this.ojmodule.format(response,this.sid);
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
            superagent.get(this.ojmodule.updateurl(pid,this.account)).set("Cookie", cookie).set(this.config['browser']).end((err,response)=>{this.connect(err,response)});
    };

    async submitAction() {
        await sleep(2000);
        //console.log("Pid:"+this.pid+" come to update");
        logger.info("Pid:" + this.pid + " come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code, cookie) {
        //console.log("to here");
        const postmsg=this.ojmodule.post_format(pid,lang,code);
        if (this.proxy.length > 4)
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
        else
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
    };

    loginAction(err, response) {
        if (err) {
            logger.fatal(err);
            //query("update vjudge_solution set result='0' where solution_id=?",[this.sid]);
            //account[this.oj_name].push(this.account);
        }
        try {
            this.submitAnswer(this.pid, this.language, this.code, response.headers["set-cookie"]);
        }
        catch (e) {
            logger.fatal(e);
            query("update vjudge_solution set result='0' where solution_id=?", [this.sid]);
            account[this.oj_name].push(this.account);
        }
    }

    login() {
        // console.log("loggin succeed");
        if (this.proxy.length > 4)
            superagent.post(this.url.login_url).set(this.config['browser']).proxy(this.proxy).send(this.account).end((err,response)=>{this.loginAction(err,response)});
        else
            superagent.post(this.url.login_url).set(this.config['browser']).send(this.account).end((err,response)=>{this.loginAction(err,response)});
    };

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.login();
    }
}

class Vjudge_daemon {
    constructor(config, oj_name) {
        this.config = config;
        this.oj_name = oj_name;
        this.ojmodule = require("./include/" + oj_name + "_module");
    }

    loop_function() {
        if (account[this.oj_name].length > 0) {
            query("select * from (select * from vjudge_solution where runner_id='0' and result='0' and oj_name='" + this.oj_name.toUpperCase() + "')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ")
                .then((rows) => {
                    if (rows.length > 0) {
                        logger.info(rows.length + " code(s) in queue.Judging");
                        for (let i = 0; i < rows.length && account[this.oj_name].length > 0; ++i) {
                            // console.log(account[this.oj_name]);
                            const solution = {
                                sid: rows[i]['solution_id'],
                                pid: rows[i]['problem_id'],
                                language: rows[i]['language'],
                                code: rows[i]['source']
                            };
                            if (account[this.oj_name].length > 0) {
                                //console.log(rows);
                                // console.log(solution);
                                const cur_account = account[this.oj_name].shift();
                                query("update vjudge_solution set result=?,judger=? where solution_id=?", [14, this.ojmodule.formatAccount(cur_account), rows[i]['solution_id']]);
                                const judger = new Judger(this.config, cur_account, this.proxy, this.oj_name);
                                judger.run(solution);
                            }
                        }
                    }
                });
        }
    }

    precheck() {
        query("update vjudge_solution set result=0 and runner_id=0 where result='14' and oj_name='" + this.oj_name.toUpperCase() + "'");
    }

    start(_proxy) {
        if (_proxy !== 'none')
            this.proxy = _proxy;
        this.precheck();
        // console.log(_proxy);
        const account_config = this.config['login'][this.oj_name];
        const len = account_config.length;
        account[this.oj_name] = [];
        for (let i = 0; i < len; ++i) {
            account[this.oj_name].push(account_config[i]);
        }
        this.loop_function();
        this.timer = setInterval(() => {
            this.loop_function()
        }, 3000);
    }

    stop() {
        clearInterval(this.timer);
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