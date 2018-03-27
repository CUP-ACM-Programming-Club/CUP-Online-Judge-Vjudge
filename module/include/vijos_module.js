const cheerio = require("cheerio");

const language = ["c", "cc", "cs", "pas", "java", "py"
    , "py3", "php", "rs", "hs", "js", "go", "rb"];
const _status = {
    "Waiting":0,
    "Fetched":14,
    "Compiling":2,
    "Judging":3,
    "Accepted":4,
    "Wrong Answer":6,
    "Time Exceeded":7,
    "Memory Exceeded":8,
    "Runtime Error":10,
    "Compile Error":11,
    "System Error":10,
    "Canceled":10,
    "Unknown Error":10,
    "Ignored":10
};
function parseStatus(stat){
    return _status[stat];
}

exports.formatLanguage = (lang) => {
    return language[lang] || "cc";
};

exports.formatSubmitUrl = (pid) => {
    return isNaN(parseInt(pid)) ?
        `https://vijos.org/d/newbzoj/p/${pid}/submit`
        :
        `https://vijos.org/p/${pid}/submit`
};

exports.formatStatusUrl = (problem_id,user_id) => {
    return isNaN(parseInt(problem_id)) ?
    `https://vijos.org/d/newbzoj/records?uid_or_name=${user_id}&pid=${problem_id}&tid=`
    :
    `https://vijos.org/records?uid_or_name=${user_id}&pid=${problem_id}&tid=`;
};

exports.formatResult = (content,submit_id) => {
    const $ = cheerio.load(content);
    const result = $(".data-table.record_main__table")
        .find(`tr[data-rid='${submit_id}']`)
        .find("td");
    let status = result.eq(0).text().trim();
    let time = result.eq(3).text().trim();
    let memory = result.eq(4).text().trim();
    status = parseStatus(status);
    if(memory.indexOf("Bytes") !== -1)
    {
        let _memory = parseInt(memory.substring(0,memory.indexOf("Bytes")));
        _memory /= 1024;
        memory = _memory;
    }
    else if(memory.indexOf("KiB") !== -1)
    {
        memory = parseInt(memory.substring(0,memory.indexOf("KiB")));
    }
    else
    {
        memory = parseInt(memory.substring(0,memory.indexOf("MiB"))) * 1024;
    }
    time = time.substring(0,time.indexOf("ms"));
    return {
        status:status,
        time:time,
        memory
    }
};

exports.formatAccount = function (account) {
    return account['uname'];
};

exports.formatSubmitId = function (url) {
    return url.substring(url.lastIndexOf("/")+1,url.length);
};