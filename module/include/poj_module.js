const cheerio = require('cheerio');
const Base64_module = require('./Base64');
const Base64 = new Base64_module();
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
    "Runtime Error": 10,
    "Compile Error": 11
};

exports.format = function (response, sid, runner_id = "") {
    const $ = cheerio.load(response.text);
    let result = $("table[cellspacing='0']").eq(0).find('tr').eq(1).find('td');
    if (isNaN(parseInt(runner_id))) {
        runner_id = result.eq(0).text();
    }
    let status = result.eq(3).text();
    status = problem_status[status];
    let time;
    let memory;
    if (status !== 4) {
        time = 0;
        memory = 0;
    }
    else {
        time = result.eq(5).text();
        time = time.substr(0, time.length - 2);
        memory = result.eq(4).text();
        memory = memory.substr(0, memory.length - 1);
    }
    if (status < 3) status = 3;
    //log("runner_id:" + runner_id + "memory:" + memory + ",time:" + time);
    //log([runner_id, status || 0, time, memory, sid]);
    return [runner_id, status || 0, time, memory, sid];
};

exports.post_format = function (pid, lang, code) {
    return {
        problem_id: pid,
        language: lang,
        source: Base64.encode(code),
        encoded: 1
    };
};

exports.updateurl = function (pid, username, runner_id = "") {
    if (typeof runner_id === "number" || !isNaN(runner_id) || parseInt(runner_id) !== 0) {
        runner_id = parseInt(runner_id) + 1;
    }
    return `http://poj.org/status?top=${runner_id}&problem_id=${pid}&user_id=${username['user_id1']}&result=&language=`;
};

exports.formatAccount = function (account) {
    return account['user_id1'];
};

exports.validSubmit = function (response) {
    const redirects = response.redirects;
    return Boolean(redirects && redirects.length > 0);
};
