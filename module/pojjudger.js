const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const mysql_module = require('./include/mysql_module');
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const sleep = sleep_module.sleep;
const log = console.log;
const Base64_module = require('./include/Base64');
const Base64 = new Base64_module();
let poj_mysql;
const problem_status = {
    "Pending": 0,
    "Queuing": 0,
    "Compiling": 2,
    "Running": 3,
    "Accepted": 4,
    "Presentation Error": 5,
    "Wrong Answer": 6,
    "Time Limit Exceeded": 7,
    "Memory Limit Exceeded": 8,
    "Output Limit Exceeded": 9,
    "Runtime Error":10,
    "Compile Error": 11
};

let proxy = "";
let account = [];

class Judger {
    constructor(config, account, proxy) {
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config['url']['poj'];
        this.cookie="";
    }

    record(rows){
        let accpeted = parseInt(rows[0]['accepted']) + 1;
        poj_mysql.query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid,"POJ"]);
    }

    async connect(err, response) {
        const $ = cheerio.load(response.text);
        const result=$("table").eq(4).find('tr').eq(1).find('td');
        const runner_id = result.eq(0).text();
        let status = result.eq(3).text();
        let time = result.eq(5).text();
        time = time.substr(0, time.length - 2);
        let memory = result.eq(4).text();
        memory = memory.substr(0, memory.length - 1);
        log("runner_id:"+runner_id+"memory:"+memory+",time:"+time);
        status = problem_status[status];
        const sid = this.sid;
        const sqlArr = [runner_id, status, time, memory, sid];
        poj_mysql.query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr);
        if (status > 3) {
            account.push(this.account);
            if (status === 4) {
                poj_mysql.query("select accepted from vjudge_problem where problem_id=? and source=?", [this.pid,"POJ"], (rows)=>{this.record(rows)});
            }
        }
        else {
            await sleep(500);
            this.updateStatus(this.pid, this.sid, this.cookie);
        }
    };

    updateStatus(pid, cookie) {
        if (this.proxy.length > 4)
            superagent.get("http://poj.org/status?problem_id="+pid+"&user_id="+this.account['user_id1']+"&result=&language=").set("Cookie", cookie).proxy(proxy).set(this.config['browser']).end((err,response)=>{this.connect(err,response)});
        else
            superagent.get("http://poj.org/status?problem_id="+pid+"&user_id="+this.account['user_id1']+"&result=&language=").set("Cookie", cookie).set(this.config['browser']).end((err,response)=>{this.connect(err,response)});
    };

    async submitAction(err,response) {
        //console.log(response);
        await sleep(2000);
        log("pid:"+this.pid+" come to update");
        this.updateStatus(this.pid, this.cookie);
    };

    submitAnswer(pid, lang, code, cookie) {
        let postmsg = {
            problem_id: pid,
            language: lang,
            source: Base64.encode(code),
            encoded:1
        };
        //console.log(postmsg);
        //console.log(this.url);
        if (proxy.length > 4)
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
        else
            superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).send(postmsg).end((err,response)=>{this.submitAction(err,response)});
    };

    loginAction(err, response) {
        this.submitAnswer(this.pid, this.language, this.code, response.headers["set-cookie"]);
    };

    login() {
        if (proxy.length > 4)
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

module.exports = function (config) {
    poj_mysql = new mysql_module(config);
    const loop_function = async function () {
        poj_mysql.query("select * from (select * from vjudge_solution where runner_id='0' and oj_name='POJ')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (rows) {
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
                    poj_mysql.query("update vjudge_solution set result=?,judger=? where solution_id=?", [14,cur_account['user_id1'],rows[i]['solution_id']]);
                    const judger = new Judger(config, cur_account, proxy);
                    judger.run(solution);
                }
            }
        });
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
        const account_config = config['login']['poj'];
        for (i in account_config) {
            account.push(account_config[i]);
        }
        runner();
        this.timer = setInterval(runner, 3000);
    };
    this.stop = function () {
        clearInterval(this.timer);
        log("Loop is stop");
    }
};