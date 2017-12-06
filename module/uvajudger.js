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
            superagent.get(this.ojmodule.updateurl(pid,this.account)).set("Cookie", cookie).proxy(proxy).set(this.config['browser']).end((err,response)=>{this.connect(err,response)});
        else
            superagent.get(this.ojmodule.updateurl(pid,this.account)).set("Cookie", cookie).set(this.config['browser']).end((err,response)=>{this.connect(err,response)});
    };

    async submitAction(err,response) {
        const $ = cheerio.load(response.text);
        //console.log($.text());
        await sleep(500);
        logger.info("PID:" + this.pid + " come to update");
        //log("pid:"+this.pid+" come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code, cookie) {
        const postmsg=this.ojmodule.post_format(pid,lang,code);
        if (proxy.length > 4)
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
        else
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
    };

    loginAction(err, response,cookie) {
        //console.log("login finished");
        // console.log(response.headers);
        //const $ = cheerio.load(response.text);
        // console.log($.text());
        this.submitAnswer(this.pid, this.language, this.code, cookie);
    };

    login(cookie) {
        if (proxy.length > 4)
            superagent.post(this.url.login_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(this.account).end((err,response)=>{this.loginAction(err,response,cookie)});
        else
            superagent.post(this.url.login_url).set("Cookie", cookie).set(this.config['browser']).send(this.account).end((err,response)=>{this.loginAction(err,response,cookie)});
    };


    accessAction(err,response)
    {
        const $ = cheerio.load(response.text);
        const hidden_elements = $("input[type=hidden]");
        for (let i = 0; i < 8; ++i) {
            this.account[hidden_elements.eq(i).attr('name')] = hidden_elements.eq(i).attr('value');
        }
        this.account['remember'] = "yes";
        console.log(this.account);
        this.login(response.headers["set-cookie"]);
        /*
        const $ = cheerio.load(response.text);
                const hidden_elements=$("input[name=cbsecuritym3]");
                this.account["op2"]="login";
                this.account["lang"]="english";
                this.account["force_session"]="1";
                this.account["return"]="B:aHR0cDovL3V2YS5vbmxpbmVqdWRnZS5vcmcv";
                this.account["message"]="0";
                this.account["loginfrom"]="loginmodule";
                this.account["cbsecuritym3"]=hidden_elements.eq(0).attr("value");
                this.account["j1a423fa7ad12ba8910ee28b44f2175f3"]=1;
                this.account['remember']="yes";
                this.login(response.headers["set-cookie"]);
        */
    }

    access(cookie){
        if (proxy.length > 4)
            superagent.get(this.url.url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).end((err,response)=>{this.accessAction(err,response)});
        else
            superagent.get(this.url.url).set("Cookie", cookie).set(this.config['browser']).end((err,response)=>{this.accessAction(err,response)});
    }

    cookieAction(err,response){
        this.access(response.headers["set-cookie"]);
    }

    getCookie(){
        if (proxy.length > 4)
            superagent.get(this.url.url).set(this.config['browser']).proxy(this.proxy).end((err,response)=>{this.cookieAction(err,response)});
        else
            superagent.get(this.url.url).set(this.config['browser']).end((err,response)=>{this.cookieAction(err,response)});
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.getCookie();
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