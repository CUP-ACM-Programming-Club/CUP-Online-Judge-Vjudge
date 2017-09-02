const mysql = require("mysql");
const http = require("http");
const https = require("https");
const querystring = require("querystring");
const log = console.log;
const mysql_module = require('./include/mysql_module');
const sleep = require('./include/functional').sleep;
const superagent = require('superagent');
const cheerio = require('cheerio');
const Base64_module=require('./include/Base64');
const Base64=new Base64_module();
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
    "Compilation Error": 11
};
let poj_mysql;
module.exports = function (config) {
    const url = config['url']['poj'];
    let running = false;
    poj_mysql = new mysql_module(config);
    const loop_function = async function () {
        if (running) return;
        poj_mysql.query("select * from (select * from vjudge_solution where runner_id='0')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (rows) {
            console.log(rows.length);
            running = true;
            if (rows.length) {
                console.log("queue has element.Running");
                await login(rows[0]['problem_id'], rows[0]['language_id'], rows[0]['source'], rows[0]['solution_id']);
            }
            else
                running = false;

        });
    };

    const login = function (pid, lang, code, sid) {
        superagent.post(url.login_url).set(config['browser']).send(config['login']['poj']).end(function (err, response) {
            let cookie = response.headers["set-cookie"];
            submitAnswer(pid, lang, code, sid, cookie);
        });
    };

    const submitAnswer = async function (pid, lang, code, sid, cookie) {
        const postmsg = {
            problem_id:pid,
            language:lang,
            source:Base64.encode(code),
            encoded:1
        };
        superagent.pushState(url.post_url).set("Cookie", cookie).set(config['browser']).send(postmsg).end(async function (err, response) {
            await sleep(1000);
            log("submit finished.sleep 1000ms");
            updateStatus(pid, sid, cookie);
        })
    };

    const updateStatus = async function (pid, sid, cookie) {
        superagent.get("http://poj.org/status?problem_id=" + pid + "&user_id=" + config['login']['poj']['user_id1'] + "&result=&language=").set("Cookie", cookie).set(config['browser']).end(async function (err, response) {
            const $ = cheerio.load(response.text);
            const table = $("table");
            let data=table.eq(4).find('tr').eq(1).find('td');
            let runner_id=data.eq(0).text();
            let status=data.eq(3).text();
            let memory=data.eq(4).text();
            let time=data.eq(5).text();
            if (status.substr(0, 13) === "Runtime Error") status = 10;
            else status = problem_status[status];
            sqlArr = [runner_id, status, time, memory, sid];
            poj_mysql.query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr);
            if (status > 3) {
                running = false;
                if (status === 4) {
                    poj_mysql.query("select accepted from vjudge_problem where problem_id=?", [pid], function (rows) {
                        let accpeted = parseInt(rows[0]['accepted']) + 1;
                        hdu_mysql.query("update vjudge_problem set accepted=? where problem_id=?", [accpeted, pid]);
                    });
                }
            }
            else {
                await sleep(500);
                updateStatus(pid, sid, cookie);
            }
            //something....
        });
    };
    const runner = async function () {
        if (running) return;
        console.log("Run poj_looping.");
        await loop_function();
        console.log("finished loop_function.");
    };
    this.start = async function () {
        runner();
        this.timer = setInterval(runner, 2000);
    }

};