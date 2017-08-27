const mysql = require('mysql');  //调用MySQL模块
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const superagent = require('superagent');
const cheerio = require('cheerio');
const hdu_mysql = require('./hdu_mysql');
const log = console.log;
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
module.exports = function (config) {
    const url = config['url']['hdu'];
    const sleep = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    let running = false;

    const loop_function = async function () {
        if (running) return;
        const connection = mysql.createConnection(config['mysql']);
        connection.connect(function (err) {
            if (err) {
                console.log('[query] - :' + err);
                return;
            }
            console.log('[connection connect]  succeed!');
        });
        connection.query("select * from (select * from vjudge_solution where runner_id='0')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (err, rows, fields) {
            if (err) {
                console.log('[query] - :' + err);
                return;
            }
            console.log(rows.length);
            running = true;
            if (rows.length > 0) {
                console.log("queue has element.Running.");
                await native_submit(rows[0]['problem_id'], rows[0]['language_id'], rows[0]['source'], rows[0]['solution_id']);
            }
            else {
                running = false;
            }
            console.log("Complete submit process");
        });
        connection.end(function (err) {
            if (err) {
                return;
            }
            console.log('[connection end] succeed!');
        });
    };
    const new_update = async function (pid, sid, cookie) {
        superagent.get("http://acm.hdu.edu.cn/status.php?first=&pid=" + pid + "&user=cupvjudge&lang=0&status=0").set("Cookie", cookie).set(config['browser']).end(async function (err, response) {
            let $ = cheerio.load(response.text);
            let tr = $(".table_text").find('tr').eq(1).find('td');
            let runner_id = tr.eq(0).text();
            let status = tr.eq(2).text();
            let time = tr.eq(4).text();
            time = time.substr(0, time.length - 2);
            let memory = tr.eq(5).text();
            memory = memory.substr(0, memory.length - 1);
            if (status.substr(0, 13) === "Runtime Error") status = 10;
            else status = problem_status[status];
            sqlArr = [runner_id, status, time, memory, sid];
            hdu_mysql(config, sqlArr);
            if (status > 3) running = false;
            else {
                await sleep(2000);
                new_update(pid, sid, cookie);
            }
        })
    };
    const post_submit = async function (pid, lang, code, sid, cookie) {
        let postmsg = {
            check: "0",
            problemid: pid,
            language: lang,
            usercode: code
        };
        superagent.post(url.post_url).set("Cookie", cookie).set(config['browser']).send(postmsg).end(async function (err, response) {
            await sleep(2000);
            log("submit finished.sleep 2000ms");
            new_update(pid, sid, cookie);
        })
    };

    const native_submit = function (pid, lang, code, sid) {
        superagent.post(url.login_url).set(config['browser']).send(config['login']['hdu']).end(function (err, response) {
            let cookie = response.headers["set-cookie"];
            post_submit(pid, lang, code, sid, cookie);
        })
    };

    async function runner() {
        if (running) return;
        console.log("Run loop_function.");
        await loop_function();
        console.log("finished loop_function.");
    }

    this.start = function () {
        runner();
        this.timer = setInterval(runner, 2000);
    };
    this.stop = function () {
        clearInterval(this.timer);
        log("Loop is stop");
    }
};