const cheerio = require('cheerio');

const problem_status = {
    0: 0,
    10: 10,
    15: 10,
    20: 0,
    30: 11,
    35: 10,
    40: 10,
    45: 9,
    50: 7,
    60: 8,
    70: 6,
    80: 5,
    90: 4
};
exports.format = function (response, sid) {
    const result = JSON.parse(response.text)['subs'][0];
    //console.log(result);
    const runner_id = result[0];
    const status = problem_status[result[2]];
    const time = result[3];
    const memory = 0;
    //console.log([runner_id, status, time, memory, sid]);
    return [runner_id, status, time, memory, sid];
};

exports.post_format = function (pid, lang, code) {
    return {
        localid: pid,
        language: lang,
        code: code
    };
};

exports.updateurl = function (pid, username, sid = null) {
    if (sid === null)
        return "https://uhunt.onlinejudge.org/api/subs-user-last/" + username['user_id'] + "/1";
    else
        return `https://uhunt.onlinejudge.org/api/subs-user/${username['user_id']}/${parseInt(sid) - 1}`;
};

exports.formatAccount = function (account) {
    return account['username'];
};

exports.validSubmit = function (response) {
    //console.log(response);
    const redirects = response.redirects;
    if (Boolean(redirects && redirects.length > 0 && redirects[0].indexOf("received") !== -1)) {
       // console.log(parseInt(redirects[0].substring(redirects[0].lastIndexOf("+") + 1, redirects[0].length)));
        return parseInt(redirects[0].substring(redirects[0].lastIndexOf("+") + 1, redirects[0].length));

    }
    else
        return false;
};
