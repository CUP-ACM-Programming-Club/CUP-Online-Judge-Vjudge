const superagent = require('superagent');
const cheerio = require('cheerio');
const mysql_module = require('./include/mysql_module');
const sleep = require('./include/functional').sleep;
const log = console.log;
let hdu_mysql;
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
    hdu_mysql = new mysql_module(config);
    const url = config['url']['hdu'];
    let running = false;

    const loop_function = async function () {
        if (running) return;
        hdu_mysql.query("select * from (select * from vjudge_solution where runner_id='0')solution left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id ", async function (rows) {
            console.log(rows.length);
            running = true;
            if (rows.length > 0) {
                console.log("queue has element.Running.");
                await login(rows[0]['problem_id'], rows[0]['language_id'], rows[0]['source'], rows[0]['solution_id']);
            }
            else {
                running = false;
            }
        });
    };
    const updateStatus = async function (pid, sid, cookie) {
        superagent.get("http://acm.hdu.edu.cn/status.php?first=&pid=" + pid + "&user=" + config['login']['hdu']['username'] + "&lang=0&status=0").set("Cookie", cookie).set(config['browser']).end(async function (err, response) {
                const $ = cheerio.load(response.text);
                const result = $(".table_text").find('tr').eq(1).find('td');
                const runner_id = result.eq(0).text();
                let status = result.eq(2).text();
                let time = result.eq(4).text();
                time = time.substr(0, time.length - 2);
                let memory = result.eq(5).text();
                memory = memory.substr(0, memory.length - 1);
                if (status.substr(0, 13) === "Runtime Error") status = 10;
                else status = problem_status[status];
                sqlArr = [runner_id, status, time, memory, sid];
                hdu_mysql.query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr);
                if (status > 3) {
                    running = false;
                    if (status === 4) {
                        hdu_mysql.query("select accepted from vjudge_problem where problem_id=?", [pid], function (rows) {
                            let accpeted = parseInt(rows[0]['accepted']) + 1;
                            hdu_mysql.query("update vjudge_problem set accepted=? where problem_id=?", [accpeted, pid]);
                        });
                    }
                }
                else {
                    await sleep(500);
                    updateStatus(pid, sid, cookie);
                }
            }
        )
    };
    const submitAnswer = async function (pid, lang, code, sid, cookie) {
        let postmsg = {
            check: "0",
            problemid: pid,
            language: lang,
            usercode: code
        };
        superagent.post(url.post_url).set("Cookie", cookie).set(config['browser']).send(postmsg).end(async function (err, response) {
            await sleep(2000);
            log("submit finished.sleep 2000ms");
            updateStatus(pid, sid, cookie);
        })
    };

    const login = function (pid, lang, code, sid) {
        superagent.post(url.login_url).set(config['browser']).send(config['login']['hdu']).end(function (err, response) {
            let cookie = response.headers["set-cookie"];
            submitAnswer(pid, lang, code, sid, cookie);
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