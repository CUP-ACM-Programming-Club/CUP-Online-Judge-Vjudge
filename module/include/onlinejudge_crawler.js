const superagent = require('superagent');
const cheerio = require('cheerio');
const mysql_module = require('./mysql_module');
const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};
module.exports = function (accountArr, config) {
    mysql = new mysql_module(config);
    const work = async (oj_name, arr) => {
        if (typeof arr === 'undefined' || arr.length === 0) return;
        mysql.query("SELECT * FROM vjudge_record WHERE user_id=? and oj_name=?", [accountArr['user_id'], oj_name], async function (rows) {
            let list = [];
            for (i in rows) {
                list[rows[i].problem_id] = 1;
            }
            for (i in arr) {
                if (!isNaN(parseInt(arr[i])) && (typeof list === 'undefined' || typeof list[arr[i]] === 'undefined')) {
                    await mysql.query("INSERT INTO vjudge_record(user_id,oj_name,problem_id,time)VALUES(?,?,?,NOW())", [accountArr['user_id'], oj_name, arr[i]]);
                    await sleep(10).then(() => {
                    });
                }
            }
        });
    };
    const hdu_crawler = (account) => {
        superagent.get("http://acm.hdu.edu.cn/userstatus.php?user=" + account).set(config['browser']).end(async function (err, response) {
            const $ = cheerio.load(response.text);
            let arr = $('table').find('table').eq(2).find('script').eq(0).html().split(';');
            for (i in arr) {
                arr[i] = arr[i].substring(arr[i].indexOf('(') + 1, arr[i].indexOf(','));
            }
            work('HDU', arr);
        })
    };

    const poj_crawler = (account) => {
        superagent.get("http://poj.org/userstatus?user_id=" + account).set(config['browser']).end(async function (err, response) {
            const $ = cheerio.load(response.text);
            let js = $("script");
            js = js.eq(1).html();
            js = js.substring(js.indexOf('}') + 1, js.length).split('\n');
            for (i in js) {
                js[i] = js[i].substring(js[i].indexOf('(') + 1, js[i].indexOf(')'));
            }
            work('POJ', js);
        })
    };

    const codeforces_crawler = (account) => {
        superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=1000").set(config['browser']).end(async function (err, response) {
            const json = JSON.parse(response.text)['result'];
            let arr = [];
            for (i in json) {
                if (json[i]['verdict'] === 'OK') {
                    let problem_id = json[i]['problem'];
                    problem_id = problem_id['contestId'] + problem_id['index'];
                    arr.push(problem_id);
                }
            }
            work('CODEFORCES', arr);
        })
    };
    const uva_crawler = (account) => {

    };

    const vjudge_crawler = (account) => {
        superagent.get("https://cn.vjudge.net/user/solveDetail/" + account).set(config['browser']).end(function (err, response) {
            const json = (JSON.parse(response.text))['acRecords'];
            const hdu = json['HDU'];
            const poj = json['POJ'];
            const codeforces = json['Gym'];
            const uva = json['UVA'];
            const uvalive = json['UVALive'];
            const fzu = json['FZU'];
            const aizu = json['Aizu'];
            const csu = json['CSU'];
            const hysbz = json['HYSBZ'];
            const spoj = json['SPOJ'];
            const uestc = json['UESTC'];
            const ural = json['URAL'];
            const zoj = json['ZOJ'];
            work('HDU', hdu);
            work('POJ', poj);
            work('CODEFORCES', codeforces);
            work('UVA', uva);
            work('UVALive', uvalive);
            work('FZU', fzu);
            work('Aizu', aizu);
            work('CSU', csu);
            work('HYSBZ', hysbz);
            work('SPOJ', spoj);
            work('UESTC', uestc);
            work('URAL', ural);
            work('ZOJ', zoj);
        });
    };
    const crawler_match = {
        "hdu": hdu_crawler,
        "poj": poj_crawler,
        "codeforces": codeforces_crawler,
        "uva": uva_crawler,
        "vjudge": vjudge_crawler
    };
    const crawler = () => {
        for (const value in accountArr) {
            if (value === 'user_id') continue;
            if (accountArr[value] !== null) crawler_match[value](accountArr[value]);
        }
    };
    this.run = () => {
        crawler();
    }
};