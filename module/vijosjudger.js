const superagent = require("superagent");
require("superagent-proxy")(superagent);
const agent = superagent.agent();
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
const eventEmitter = require("events").EventEmitter;
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account')

class Judger extends eventEmitter {
    constructor(config, account, proxy, oj_name) {
        super();
        this.proxy = proxy;
        this.account = account;
        this.config = config;
        this.url = config.url.oj_name;
        this.oj_name = oj_name;
        this.cookie = "";
        this.ojmodule = require(`./include/${this.oj_name}_module`);
        this.finished = false;
        logger.info(`constructed ${this.oj_name} Judger`);
    }

    proxy_check(agent_module){
        agent_module = agent_module.set(this.config.browser);
        if(this.proxy.length>4){
            return agent_module.proxy(this.proxy);
        }
        else{
            return agent_module;
        }
    }

    update() {

    }

    login(){
        this.proxy_check(agent)
            .post(this.url.login_url)
            .end((err,response)=>{
                this.submit();
            });
    }

    submit() {
	    if(!this.setTimeout) {
		    setTimeout(()=>{
			    this.setTimeout = true;
			    if(!this.finished) {
				    this.error()
			    }
		    },1000*60*2);
	    }
	    const url = this.ojmodule.formatSubmitUrl(this.pid);
        this.proxy_check(agent)
            .get(url)
            .end((err,response)=>{
                if(response.text.indexOf(this.account.uname) === -1){
                    this.login();
                }
                else{
                    const $ = cheerio.load(response.text);
                    const csrf_token = $("input").eq(0).attr("value");
                    const submit_obj = {
                      lang:this.ojmodule.formatLanguage(this.language),
                      code:this.code,
                      csrf_token:csrf_token
                    };
                    this.proxy_check(agent)
                        .post(url)
                        .send(submit_obj)
                        .end((err,response)=>{
                            sleep(500)
                                .then(()=>{

                                })
                        });
                }
            })
    }

    run(solution) {
        this.pid = solution.pid;
        this.sid = solution.sid;
        this.code = solution.code;
        this.language = solution.language;
        this.finished = false;
        logger.info(`run judger for sid:${this.sid}`);
        this.login();
    }
}
/*
const user = {
    uname: "",
    password: ""
};
const config = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36"
    ,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
};

const submit_data = {
    lang: "",
    code: ``
};

(async () => {
    await new Promise((resolve => {
        agent.post("https://vijos.org/d/newbzoj/login")
            .send(user)
            .set(config)
            .end((err, response) => {
                resolve();
            });
    }));
    const response = await new Promise(resolve => {
        agent.get("https://vijos.org/d/newbzoj/p/590c8d0dd3d8a13210993708/submit")
            .set(config)
            .end((err, response) => {
                resolve(response);
            })
    });
    const $ = cheerio.load(response.text);
    submit_data["csrf_token"] = $("input").eq(0).attr("value");
    //console.log($("input").eq(0).attr("value"));
    //console.log(response.text);
    await new Promise(resolve => {
        agent.post("https://vijos.org/d/newbzoj/p/590c8d0dd3d8a13210993708/submit")
            .set(config)
            .send(submit_data)
            .end((err, response) => {
                console.log(response);
                console.log(response.headers);
                resolve();
            })
    });
    return;
})();
*/