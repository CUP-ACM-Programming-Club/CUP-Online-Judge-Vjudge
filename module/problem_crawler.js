const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const query = require('./include/mysql_module');

class Crawler {
    constructor(config) {
        this.config = config;
        if (config['proxy'] !== 'none')
            this.proxy = config['proxy'];
        else
            this.proxy = "";
        this.start();
        this.timer = setInterval(() => {
            this.start()
        }, 10 * 60 * 1000);
    }

    static mysql_query(arr) {
        query("insert into vjudge_problem(title,description,input,output,sample_input,sample_output,problem_id,source,time_limit,memory_limit)" +
            " values(?,?,?,?,?,?,?,?,?,?)", [arr['title'], arr['description'], arr['input'], arr['output'], arr['sample_input'], arr['sample_output'], arr['problem_id'], arr['oj_name'], arr['time_limit'], arr['memory_limit']]);
    }

    async start() {
        const result = await this.query("SELECT max(problem_id) as start FROM vjudge_problem WHERE source='HDU'");
        const start = parseInt(result[0].start) + 1;
        this.hdu_crawler(start);
    }

    hdu_crawlerAction(err, response, pid) {
        if (response.text.indexOf("No such problem") === -1) {
            console.log("crawling " + pid);
            let $ = cheerio.load(response.text);
            let title = $("title").eq(0).html();
            title = title.substr(title.indexOf('- ') + 2, title.length);
            let title_name = $("h1").eq(0).html();
            let time_memory_txt = $("span").eq(0).html();
            let time_limit_txt = time_memory_txt.match(/Time Limit:[\s\S]+MS/)[0];
            let memory_limit_txt = time_memory_txt.match(/Memory Limit:[\s\S]+K/)[0];
            let time_limit = time_limit_txt.match(/[0-9]+(?= MS)/)[0];
            let memory_limit = memory_limit_txt.match(/[0-9]+(?= K)/)[0];
            time_limit = parseFloat(time_limit) / 1000;
            memory_limit = parseInt(memory_limit) / 1024;
            const content = $(".panel_content");
            const content_length = content.length;
            for (let i = 0; i < content_length; ++i) {
                if (content.eq(i).html().indexOf("<img") !== -1) {
                    const img_length = content.eq(i).find('img');
                    for (let j = 0; j < img_length; ++j) {
                        let src = content.eq(i).find('img').eq(j).attr('src');
                        if (src.indexOf('http') === -1) {
                            src = "http://acm.hdu.edu.cn" + src.substr(src.indexOf("/data"), src.length);
                            content.eq(i).find('img').eq(j).attr('src', src);
                        }
                    }
                }
            }
            let description = content.eq(0).html();
            let input = content.eq(1).html();
            let output = content.eq(2).html();
            let sample_input = content.eq(3).html();
            let sample_output = content.eq(4).html();
            let question_arr = {
                "description": description,
                "input": input,
                "output": output,
                "sample_input": sample_input,
                "sample_output": sample_output,
                "oj_name": "HDU",
                "problem_id": title,
                "title": title_name,
                "time_limit": time_limit,
                "memory_limit": memory_limit
            };
            Crawler.mysql_query(question_arr);
            this.hdu_crawler(pid + 1);
        }
    }

    async hdu_crawler(pid) {
        if (this.proxy.length > 4) {
            superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid=" + pid).set(this.config['browser']).proxy(this.proxy).end(function (err, response) {
                this.hdu_crawlerAction(err, response, pid);
            });
        }
        else
            superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid=" + pid).set(this.config['browser']).end(function (err, response) {
                this.hdu_crawlerAction(err, response, pid);
            });
    }
}

module.exports = Crawler;
