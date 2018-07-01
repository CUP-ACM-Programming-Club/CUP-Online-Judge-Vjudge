const problem_status = {
    "Pending": 0,
    "Queuing": 0,
    "Compiling": 2,
    "running": 3,
    "AC": 4,
    "PE": 5,
    "WA": 6,
    "TL": 7,
    "ML": 8,
    "OL": 9,
    "RE_SEGV":10,
    "CE": 11
};

const language_list = ["c","c++","c++14","java","python","python3","ruby","blockly","octave"];
const language_files = ["main.c","main.cpp","main.cpp","Main.java","main.py","main.py","main.rb","main.bl","main.m"];

exports.format = function (response) {
    const receive_data = response;
    if(receive_data.status === "finished" && receive_data.data && receive_data.data.reason) {
        return problem_status[receive_data.data.reason];
    }
    else {
        if (receive_data.status === "running") {
            return 3;
        }
        else if (receive_data.status === "fail") {
            return 15;
        }
        else {
            return 3;
        }
    }
};

exports.post_format = function (pid, lang, code) {
    return {
        id:pid,
        file:[language_files[lang]],
        codes:[code],
        language:language_list[lang]
    };
};

exports.updateurl = function (response) {
    return `https://nanti.jisuanke.com/solve/check/${JSON.parse(response.text).data}`;
};

exports.formatAccount = function (account) {
    return "cupvjudge";
};


exports.findxsrf = function (cookies) {
    let tmp_xsrf, token;
    if(cookies && cookies.length) {
        for (let i of cookies) {
            if (i.indexOf("XSRF") !== -1) {
                tmp_xsrf = i;
                break;
            }
        }
        if (typeof tmp_xsrf !== "string") {
            return false;
        }
        tmp_xsrf = tmp_xsrf.split(";");
        for (let i of tmp_xsrf) {
            let tmp = i.split("=");
            if (tmp[0] === "XSRF-TOKEN") {
                token = tmp[1];
                break;
            }
        }
        return token;
    }
    else{
        return false;
    }
};
