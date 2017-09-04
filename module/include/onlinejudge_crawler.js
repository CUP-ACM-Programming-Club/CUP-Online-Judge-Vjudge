const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const mysql_module = require('./mysql_module');
const functional_module = require('./functional');
const functional = new functional_module();
const sleep = functional.sleep;
let proxy = "";
module.exports = function (accountArr, config) {
    mysql = new mysql_module(config);
    if (typeof config['proxy'] !== 'undefined' && typeof  config['proxy'] !== null)
        proxy = config['proxy'];
    const save_to_database = async (oj_name, arr) => {
        if (typeof arr === 'undefined' || arr.length === 0) return;
        mysql.query("SELECT * FROM vjudge_record WHERE user_id=? and oj_name=?", [accountArr['user_id'], oj_name], async function (rows) {
            let list = [];
            for (i in rows) {
                list[rows[i].problem_id] = 1;
            }
            for (i in arr) {
                if (arr[i].toString().length > 0 && (typeof list === 'undefined' || typeof list[arr[i]] === 'undefined')) {
                    await mysql.query("INSERT INTO vjudge_record(user_id,oj_name,problem_id,time)VALUES(?,?,?,NOW())", [accountArr['user_id'], oj_name, arr[i]]);
                    await sleep(10).then(() => {
                    });
                }
            }
        });
    };

    const hduAction = async function (err, response) {
        const $ = cheerio.load(response.text);
        let arr = $('table').find('table').eq(2).find('script').eq(0).html().split(';');
        for (i in arr) {
            arr[i] = arr[i].substring(arr[i].indexOf('(') + 1, arr[i].indexOf(','));
        }
        save_to_database('HDU', arr);
    };

    const hdu_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("http://acm.hdu.edu.cn/userstatus.php?user=" + account).proxy(proxy).set(config['browser']).end(hduAction);
        else
            superagent.get("http://acm.hdu.edu.cn/userstatus.php?user=" + account).set(config['browser']).end(hduAction);
    };

    const pojAction = async function (err, response) {
        const $ = cheerio.load(response.text);
        let js = $("script");
        js = js.eq(1).html();
        js = js.substring(js.indexOf('}') + 1, js.length).split('\n');
        for (i in js) {
            js[i] = js[i].substring(js[i].indexOf('(') + 1, js[i].indexOf(')'));
        }
        save_to_database('POJ', js);
    };

    const poj_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("http://poj.org/userstatus?user_id=" + account).proxy(proxy).set(config['browser']).end(pojAction);
        else
            superagent.get("http://poj.org/userstatus?user_id=" + account).set(config['browser']).end(pojAction);
    };

    const codeforcesAction = async function (err, response) {
        const json = JSON.parse(response.text)['result'];
        let arr = [];
        for (i in json) {
            if (json[i]['verdict'] === 'OK') {
                let problem_id = json[i]['problem'];
                problem_id = problem_id['contestId'] + problem_id['index'];
                arr.push(problem_id);
            }
        }
        save_to_database('CODEFORCES', arr);
    };

    const codeforces_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=1000").set(config['browser']).proxy(proxy).end(codeforcesAction);
        else
            superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=1000").set(config['browser']).end(codeforcesAction);
    };
    const uva_crawler = (account) => {
        /*
        console.log(account);
        superagent.post("https://uva.onlinejudge.org/index.php?option=com_comprofiler&task=login").set(config['browser']).send().end();
        superagent.get("https://uva.onlinejudge.org/index.php?option=com_onlinejudge&Itemid=8&page=show_authorstats&nick="+account).set(config['browser']).end(async function(err,response){
            const $ = cheerio.load(response.text);
            let table = $('table');
            console.log($.html());
        })
        */
    };

    const vjudgeAction = function (err, response) {
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
        const kattis = json['Kattis'];
        save_to_database('HDU', hdu);
        save_to_database('POJ', poj);
        save_to_database('CODEFORCES', codeforces);
        save_to_database('UVA', uva);
        save_to_database('UVALive', uvalive);
        save_to_database('FZU', fzu);
        save_to_database('Aizu', aizu);
        save_to_database('CSU', csu);
        save_to_database('HYSBZ', hysbz);
        save_to_database('SPOJ', spoj);
        save_to_database('UESTC', uestc);
        save_to_database('URAL', ural);
        save_to_database('ZOJ', zoj);
        save_to_database('Kattis', kattis);
    };

    const vjudge_crawler = (account) => {
        if (proxy.length > 4)
            superagent.get("https://cn.vjudge.net/user/solveDetail/" + account).set(config['browser']).proxy(proxy).end(vjudgeAction);
        else
            superagent.get("https://cn.vjudge.net/user/solveDetail/" + account).set(config['browser']).end(vjudgeAction);
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