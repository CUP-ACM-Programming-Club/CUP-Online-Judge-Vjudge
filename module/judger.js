const superagent = require('superagent');
require('superagent-proxy')(superagent);
const functional_module = require('./include/functional');
const sleep_module = new functional_module();
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const sleep = sleep_module.sleep;
const query = require('./include/mysql_module');
const eventEmitter = require("events").EventEmitter;
log4js.connectLogger(logger, {level: 'info'});
let account = require('./include/account');

class Judger extends eventEmitter {
	constructor(config, account, proxy, oj_name) {
		super();
		this.proxy = proxy;
		this.account = account;
		this.config = config;
		this.url = config['url'][oj_name];
		this.oj_name = oj_name;
		this.cookie = "";
		this.ojmodule = require("./include/" + this.oj_name + "_module");
		this.finished = false;
		logger.info(`constructed Judger`);
	}

	static valid_judge(err, response) {
		if (err || response.text.indexOf("wwwcache1.hdu.edu.cn") !== -1) {
			logger.warn(err || "Server cannot work");
			return false;
		}
		else {
			return true;
			//this.login();
		}
	}

	async record(rows) {
		let accpeted = (parseInt(rows[0]['accepted']) + 1) || 1;
		try {
			query("update vjudge_problem set accepted=? where problem_id=? and source=?", [accpeted, this.pid, this.oj_name.toUpperCase()]);
		}
		catch (e) {
			this.record(rows);
		}
	}

	async connect(err, response) {
		if (err) {
			logger.fatal(err);
		}
		try {
			const sqlArr = this.ojmodule.format(response, this.sid);
			const status = sqlArr[1];
			this.result = sqlArr;
			query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?", sqlArr)
				.then(resolve => {
				}).catch(err => {
				logger.fatal("error:\nsqlArr");
				logger.fatal(sqlArr);
				logger.fatal(err)
			});
			if (status > 3) {
				this.finished = true;
				//account[this.oj_name].push(this);
				this.emit("finish");
				if (status === 4) {
					query("select accepted from vjudge_problem where problem_id=? and source=?", [this.pid, this.oj_name.toUpperCase()])
						.then((rows) => {
							this.record(rows);
						}).catch((err) => {
						logger.fatal("ERROR:select\n");
						logger.fatal(err);
						this.error();
					});
				}
			}
			else {
				await sleep(500);
				this.updateStatus(this.pid, this.sid, this.cookie);
			}
		}
		catch (e) {
			logger.fatal(e);
			account[this.oj_name].push(this);
			this.error();
		}
	};

	updateStatus(pid, cookie) {
		if (this.proxy.length > 4)
			superagent.get(this.ojmodule.updateurl(pid, this.account)).set("Cookie", cookie).proxy(this.proxy).set(this.config['browser']).end((err, response) => {
				this.connect(err, response)
			});
		else
			superagent.get(this.ojmodule.updateurl(pid, this.account)).set("Cookie", cookie).set(this.config['browser']).end((err, response) => {
				this.connect(err, response)
			});
	};

	async submitAction() {
		await sleep(500);
		//console.log(`PID:${this.pid} come to update`);
		logger.info("PID:" + this.pid + " come to update");
		this.updateStatus(this.pid, this.cookie);
	};

	submitAnswer(pid, lang, code, cookie) {
		const postmsg = this.ojmodule.post_format(pid, lang, code);
		if (this.proxy.length > 4)
			superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).proxy(this.proxy).send(postmsg).end((err, response) => {
				this.submitAction(err, response)
			});
		else
			superagent.post(this.url.post_url).set("Cookie", cookie).set(this.config['browser']).send(postmsg).end((err, response) => {
				this.submitAction(err, response)
			});
	};

	loginAction(err, response, cookie) {
		if (err) {
			logger.fatal(err);
		}
		try {
			this.submitAnswer(this.pid, this.language, this.code, cookie);
		}
		catch (e) {
			logger.fatal(e);
			this.error();
		}
	}

	async error() {
		try {
			await query("update vjudge_solution set result='0' and runner_id='0' where solution_id=?", [this.sid]);
		}
		catch (e) {
			this.error();
		}
		this.emit("finish");
	}

	getAccount() {
		return this.account;
	}

	login() {
		if (!this.setTimeout) {
			setTimeout(() => {
				this.setTimeout = true;
				if (!this.finished) {
					this.error();
				}
			}, 1000 * 60 * 2);
		}
		if (this.proxy.length > 4)
			superagent.post(this.url.login_url).set(this.config['browser']).proxy(this.proxy).send(this.account).end((err, response) => {
				this.loginAction(err, response, response.headers["set-cookie"]);
			});
		else
			superagent.post(this.url.login_url).set(this.config['browser']).send(this.account).end((err, response) => {
				this.loginAction(err, response, response.headers["set-cookie"]);
			});
	};

	async website_valid_check() {
		let valid = true;
		if (this.proxy.length > 4)
			await superagent.get(this.url.url).set(this.config['browser']).proxy(this.proxy).end((err, response) => {
				valid = Judger.valid_judge(err, response);
			});
		else
			await superagent.get(this.url.url).set(this.config['browser']).end((err, response) => {
				valid = Judger.valid_judge(err, response);
			});
		return valid;
	}

	run(solution) {
		this.pid = solution.pid;
		this.sid = solution.sid;
		this.code = solution.code;
		this.language = solution.language;
		this.finished = false;
		//console.log(solution);
		logger.info(`run judger for sid:${this.sid}`);
		//this.website_valid_check();
		this.login();
	}
}

module.exports = Judger;