const superagent = require("superagent");
require("superagent-proxy")(superagent);
const cheerio = require("cheerio");
const agent = superagent.agent();
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
log4js.connectLogger(logger, {level: 'info'});
const vijosJudger = require("./vijosjudger");

class Judger extends vijosJudger {
	constructor(config, account, proxy, oj_name) {
		super(...arguments);
		this.proxy = proxy;
		this.account = account;
		this.config = config;
		this.url = config.url["vijos"];
		this.oj_name = "BZOJ";
		this.cookie = "";
		this.ojmodule = require(`./include/vijos_module`);
		this.finished = false;
		logger.info(`constructed BZOJ Judger`);
	}


	update(submit_id) {
		const that = this;
		this.proxy_check(agent.get(that.ojmodule.formatStatusUrl(that.originalProblemId, this.account.uname)))
			.end((err, response) => {
				if(!err){
					clearTimeout(that.setTimeout);
					setTimeout(() => {
						that.setTimeout = true;
						if (!that.finished) {
							that.error()
						}
					}, 1000 * 60 * 2);
				}
				const result = that.ojmodule.formatResult(response.text, submit_id);
				query(`update vjudge_solution set runner_id = ?,
                result = ?,time = ?,memory = ? where solution_id = ?`,
					[submit_id,result.status,result.time,result.memory,that.sid])
					.then(()=>{})
					.catch((err)=>{
						console.log(err);
					});
				if (result.status > 3) {
					that.finished = true;
					that.emit("finish");
					if (result.status === 4) {
						query(`select accepted from vjudge_problem 
                        where problem_id = ? and source = ?`,
							[this.pid, this.oj_name.toUpperCase()])
							.then((rows) => {
								that.record(rows);
							})
							.catch((err) => {
								logger.fatal(err);
							})
					}
				}
				else {
					sleep(500)
						.then(that.update(that.ojmodule.formatSubmitId(submit_id[0])));
				}
			})
	}

	submit() {
		const that = this;
		if (!this.setTimeout) {
			setTimeout(() => {
				that.setTimeout = true;
				if (!that.finished) {
					that.error()
				}
			}, 1000 * 60 * 2);
		}
		const url = this.ojmodule.formatSubmitUrl(this.originalProblemId);
		this.proxy_check(agent.get(url))
			.end((err, response) => {
				if (response.text.indexOf(that.account.uname) === -1) {
					that.login();
				}
				else {
					const $ = cheerio.load(response.text);
					const csrf_token = $("input").eq(0).attr("value");
					const submit_obj = {
						lang: that.ojmodule.formatLanguage(this.language),
						code: that.code,
						csrf_token: csrf_token
					};
					that.proxy_check(agent.post(url))
						.send(submit_obj)
						.end((err, response) => {
							sleep(500)
								.then(() => {
									that.update(that.ojmodule.formatSubmitId(response.redirects[0]));
									return;
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
		query(`select * from vjudge_original_problem where source = "BZOJ" and problem_id = ?`,[this.pid])
			.then(rows=>{
				this.originalProblemId = rows[0].original_problem_id;
				this.submit();
			});
	}
}

module.exports = Judger;
