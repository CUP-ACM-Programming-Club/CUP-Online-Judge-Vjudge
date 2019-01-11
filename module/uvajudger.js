const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
log4js.connectLogger(logger, {level: 'info'});
const Judger = require('./judger');

class UVaJudger extends Judger {
    constructor(config, account, proxy, oj_name) {
        super(config, account, proxy, oj_name);
    }

    accessAction(err, response) {
        if (err) {
            logger.fatal(err);
        }
        try {
            const $ = cheerio.load(response.text);
            const hidden_elements = $("input[type=hidden]");
            for (let i = 0; i < 8; ++i) {
                this.account[hidden_elements.eq(i).attr('name')] = hidden_elements.eq(i).attr('value');
            }
            //console.log(response.headers);
            this.account['remember'] = "yes";
            this.agent._saveCookies(response);
            this.login(response.headers["set-cookie"]);

        }
        catch (e) {
            logger.fatal(e);
            this.error()
                .catch(err => logger.fatal(err));
        }
    }

    access(cookie) {
        this.proxy_check(superagent.get(this.url.url).set("Cookie", cookie))
            .end((err, response) => {
                this.accessAction(err, response);
            })
    }

    cookieAction(err, response) {
        if (err) {
            logger.fatal(err);
        }
        try {
            this.access(response.headers["set-cookie"]);
        }
        catch (e) {
            logger.fatal(e);
            this.error();
        }
    }


    getCookie() {
        if(this.check_login()) {
            this.login();
            return;
        }
        this.proxy_check(superagent.get(this.url.url))
            .end((err, response) => {
                //     if(err)console.log(err)
                //     this.proxy_check(this.agent.get(this.url.url))
                //                     .end((err,response)=>{
                //   if(err)console.log(err)
                this.cookieAction(err, response);
            });
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.finished = false;
        this.getCookie();
    }
}


module.exports = UVaJudger;
