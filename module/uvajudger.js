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
            this.account['remember'] = "yes";
            this.login();
        }
        catch (e) {
            logger.fatal(e);
            this.error()
                .catch(err => logger.fatal(err));
        }
    }


    getCookie() {
        this.proxy_check(this.agent.get(this.url.url))
            .end((err, response) => {
                this.accessAction(err, response);
            });
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.getCookie();
    }
}


module.exports = UVaJudger;
