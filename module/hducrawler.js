const superagent = require('superagent');
require('superagent-charset')(superagent);
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const mysql_module = require('./module/include/mysql_module');
const functional_module = require('./module/include/functional');
const sleep_module = new functional_module();
const sleep = sleep_module.sleep;
const log = console.log;
const iconv=require('iconv-lite');
let mysql;
const config = require('./config.json');

mysql = new mysql_module(config);
let proxy="";
let current;
const mysql_query = function (arr) {
    //mysql.query("update vjudge_problem set description=?,input=?,output=?,sample_input=?,sample_output=? " +
    //    "where problem_id=? and source=?", [arr['description'], arr['input'], arr['output'], arr['sample_input'], arr['sample_output'], arr['problem_id'], arr['oj_name']]);
};

const hdu_crawlerAction = function (err, response) {
    if(response.text.indexOf("System Message")!==-1)return;
    let res=response.text;
    //res=iconv.decode(res,'GBK');
    let $ = cheerio.load(res);
    let title = $("title").eq(0).html();
    // if(title===null)return;
    title = title.substring(title.indexOf('- ')+2,title.length);
    console.log(title);
    const content = $(".panel_content");
    const content_length = content.length;
    for (let i = 0; i < content_length; ++i) {
        if (content.eq(i).html().indexOf("<img") !== -1) {
            const img_length = content.eq(i).find('img').length;
            for (let j = 0; j < img_length; ++j) {
                let src = content.eq(i).find('img').eq(j).attr('src');
                if (src.indexOf('http') === -1) {
                    src = "http://acm.hdu.edu.cn" + src.substring(src.indexOf("/data"), src.length);
                    content.eq(i).find('img').eq(j).attr('src', src);
                    log(content.eq(i).find('img').eq(j).attr('src'));
                }
            }
        }
    }
    let description = content.eq(0).html();
    let input = content.eq(1).html();
    let output = content.eq(2).html();
    let sample_input = content.eq(3).text();
    let sample_output = content.eq(4).text();
    let question_arr = {
        "description": description,
        "input": input,
        "output": output,
        "sample_input": sample_input,
        "sample_output": sample_output,
        "oj_name": "HDU",
        "problem_id": title
    };
    mysql_query(question_arr);
};

const hdu_crawler = async function (pid) {
    //console.log(pid);
    if (proxy.length > 4)
        superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid=" + pid).charset('gbk').set(config['browser']).proxy(proxy).end(hdu_crawlerAction);
    else
        superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid=" + pid).charset('gbk').set(config['browser']).end(hdu_crawlerAction);
};
const _proxy=config['proxy'];
if (_proxy !== 'none')
    proxy = _proxy;
current=3533;
const start=async function(){
    for(let i=current;i<3534;++i)
    {
        hdu_crawler(i);
        await sleep(30);
    }
};
start();

//hdu_crawler();
//  this.timer=setInterval(hdu_crawler,10*60*1000);
