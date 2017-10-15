const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio=require('cheerio');
const mysql_module = require('./include/mysql_module');
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const sleep = sleep_module.sleep;
const log = console.log;
let mysql;

module.exports=function(config){
    mysql=new mysql_module(config);

    const mysql_query=function(arr)
    {
        mysql.query("update vjudge_problem set description=?,input=?,output=?,sample_input=?,sample_output=? " +
            "where problem_id=? and source=?",[arr['description'],arr['input'],arr['output'],arr['sample_input'],arr['sample_output'],arr['problem_id'],arr['oj_name']]);
    };

    const hdu_crawlerAction=function(err,response){
            let $=cheerio.load(response.text);
            let title=$("title").eq(0).html();
            title=title.substring(title.indexOf('- ',title.length));
            const content=$(".panel_content");
            const content_length=content.length;
            for(let i=0;i<content_length;++i)
            {
                if(content.eq(i).html().indexOf("<img")!==-1)
                {
                    const img_length=content.eq(i).find('img');
                    for(let j=0;j<img_length;++j)
                    {
                        let src=content.eq(i).find('img').eq(j).attr('src');
                        if(src.indexOf('http')===-1)
                        {
                            src="http://acm.hdu.edu.cn"+src.substring(src.indexOf("/data"),src.length);
                            content.eq(i).find('img').eq(j).attr('src',src);
                        }
                    }
                }
            }
            let description=content.eq(0).html();
            let input=content.eq(1).html();
            let output=content.eq(2).html();
            let sample_input=content.eq(3).html();
            let sample_output=content.eq(4).html();
            let question_arr={
                "description":description,
                "input":input,
                "output":output,
                "sample_input":sample_input,
                "sample_output":sample_output,
                "oj_name":"HDU",
                "problem_id":title
            }
            mysql_query(question_arr);
    };

    const hdu_crawler=async function(pid) {
        if (this.proxy.length > 4)
            superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid="+pid).set(config['browser']).proxy(proxy).end(hdu_crawlerAction);
        else
            superagent.get("http://acm.hdu.edu.cn/showproblem.php?pid="+pid).set(config['browser']).end(hdu_crawlerAction);
    };

    this.start=async function(_proxy){
        if(_proxy!=='none')
            proxy=_proxy;
        for(let i=1000;i<6217;++i)
        {
            hdu_crawler(i);
            await sleep(30);
        }
        //hdu_crawler();
      //  this.timer=setInterval(hdu_crawler,10*60*1000);
    };
    this.stop=function(){
        clearInterval(this.timer);
        log("stop");
    }
};
