const cheerio = require('cheerio');
const { encodeGBK, decodeGBK } = require('gbk-string');
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

exports.format = function (response, sid, runner_id = null) {
    const $ = cheerio.load(response.text);
    const result = $(".table_text").find('tr').eq(1).find('td');
    if(runner_id === null)
        runner_id = result.eq(0).text();
    let status = result.eq(2).text();
    let time = result.eq(4).text();
    time = time.substr(0, time.length - 2);
    let memory = result.eq(5).text();
    memory = memory.substr(0, memory.length - 1);
    log("runner_id:" + runner_id + "memory:" + memory + ",time:" + time);
    if (status.substr(0, 13) === "Runtime Error") status = 10;
    else status = problem_status[status];
    if (status < 3) status = 3;
    return [runner_id, status, time, memory, sid];
};

exports.post_format = function (pid, lang, code) {
    return `check=0&problemid=${pid}&language=${lang}&usercode=${encodeGBK(code).replace(/%A/g, "%0A")}`;
};

exports.updateurl = function (pid, username,sid = "") {
    return `http://acm.hdu.edu.cn/status.php?first=${sid}&pid=${pid}&user=${username['username']}&lang=0&status=0`;
};

exports.formatAccount = function (account) {
    return account['username'];
};

exports.validSubmit = function (response) {
    const redirects = response.redirects;
    return Boolean(redirects && redirects.length > 0);
};
