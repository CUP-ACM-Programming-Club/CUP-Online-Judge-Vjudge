const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const mysql_module = require('./include/mysql_module');
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const sleep = sleep_module.sleep;
const log = console.log;
let mysql;


let proxy = "";
let account = [];

class Judger {
    constructor(config, account, proxy,oj_name) {
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
        mysql.query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid,this.oj_name.toUpperCase()]);
    }

    async connect(err, response) {
        console.log(response.text);
        const sqlArr = this.ojmodule.format(response,this.sid);
        mysql.query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr);
        if (sqlArr[1] > 3) {
            account.push(this.account);
            if (sqlArr[1] === 4) {
                mysql.query("select accepted from vjudge_problem where problem_id=? and source=?", [this.pid,this.oj_name.toUpperCase()], (rows)=>{this.record(rows)});
            }
        }
        else {
            await sleep(500);
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
        console.log($.text());
        await sleep(500);
        log("pid:"+this.pid+" come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code, cookie) {
        console.log(cookie);
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
       // console.log(response);
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
       // this.pid = solution.pid;
       // this.sid = solution.sid;
       // this.code = solution.code;
      //  this.language = solution.language;
        this.getCookie();
    }
}

module.exports = function (config,oj_name) {
    const ojmodule=require("./include/"+oj_name+"_module");
    mysql = new mysql_module(config);
    const loop_function = async function () {
        mysql.query("select * from (select * from vjudge_solution where runner_id='0' and result='0' and oj_name='"+oj_name.toUpperCase()+"')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (rows) {
            console.log(rows.length);
            if (rows.length > 0) {
                console.log("queue has "+rows.length+" element.Running.");
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
        const cur_account=account.shift();
        const judger = new Judger(config, cur_account, proxy,oj_name);
        judger.run();
    };


    async function runner() {
        log(account);
        console.log("Run loop_function.");
        await loop_function();
        console.log("finished loop_function.");
    }

    this.start = function (_proxy) {
        if (_proxy !== 'none')
            proxy = _proxy;
        const account_config = config['login'][oj_name];
        for (i in account_config) {
            account.push(account_config[i]);
        }
        runner();
      //  this.timer = setInterval(runner, 3000);
    };
    this.stop = function () {
        clearInterval(this.timer);
        log("Loop is stop");
    }
};