const superagent = require('superagent');
require('superagent-proxy')(superagent);
const log4js = require('./logger');
const logger = log4js.logger('cheese', 'info');
const query = require('./include/mysql_module');
log4js.connectLogger(logger, {level: 'info'});

let account = require('./include/account');
let solution_id_queue = [];
let solution_id_data = {};

function addQueue(solution_id, data) {
    if(solution_id_queue.indexOf(solution_id) === -1) {
        solution_id_queue.push(solution_id);
        solution_id_data[solution_id] = data;
    }
}

function removeQueue(solution_id) {
    let idx;
    if((idx = solution_id_queue.indexOf(parseInt(solution_id))) !== -1) {
        solution_id_queue.splice(idx, 1);
    }
    if(solution_id_data[solution_id]) {
        delete solution_id_data[solution_id];
    }
}

const judger_list = {
    hdu: "",
    poj: "",
    uva: "uva",
    jsk: "jsk",
    vijos: "vijos",
    bzoj: "bzoj"
};

class Vjudge_daemon {
    constructor(config, oj_name) {
        this.config = config;
        this.oj_name = oj_name;
        this.ojmodule = require("./include/" + oj_name + "_module");
        console.log(oj_name);
        this.judger = require(`./${judger_list[oj_name]}judger`);
    }

    async loop_function() {
        if (account[this.oj_name].length > 0) {
            const rows = await query(`select * from (select * from vjudge_solution where result = 0
             and runner_id = 'empty' and oj_name='${this.oj_name.toUpperCase()}')solution
              left join vjudge_source_code as vcode on vcode.solution_id=solution.solution_id `);
            if (rows.length > 0) {
                console.log("come");
                logger.info(rows.length + " code(s) in queue.Judging");
                for (let i = 0; i < rows.length && account[this.oj_name].length > 0; ++i) {
                    console.log(`In judging loop ${i}`);
                    let solution_id = parseInt(rows[i]['solution_id']);
                    const solution = {
                        sid: solution_id,
                        pid: rows[i]['problem_id'],
                        language: rows[i]['language'],
                        code: rows[i]['source']
                    };

                    if (account[this.oj_name].length > 0) {
                        if(solution_id_queue.indexOf(solution_id) === -1) {
                            console.log(`catch using account ${account[this.oj_name]}`);
                            const cur_judger = account[this.oj_name].shift();
                            query("update vjudge_solution set result=?,judger=? where solution_id=?", [14, this.ojmodule.formatAccount(cur_judger.getAccount()), rows[i]['solution_id']]);
                            cur_judger.run(solution);
                        }
                        else {
                            console.log("in queue");
                        }
                    }
                    else {
                        addQueue(parseInt(rows[i]["solution_id"]), solution);
                    }
                }
            }
        }
    }

    buildJudger(_account) {
        let judger = new this.judger(this.config, _account, this.proxy, this.oj_name);
        judger.on("finish", () => {
            account[this.oj_name].push(judger);
            if (judger.setTimeout) {
                clearTimeout(judger.setTimeout);
            }
            removeQueue(judger.sid);
            if(solution_id_queue.length > 0) {
                const cur_judger = account[this.oj_name].shift();
                let solution = solution_id_data.shift();
                query("update vjudge_solution set result=?,judger=? where solution_id=?",
                    [14, this.ojmodule.formatAccount(cur_judger.getAccount()), solution.sid]);
                cur_judger.run(solution);
            }
        });
        return judger;
    }


    async start(_proxy) {
        if (_proxy !== 'none')
            this.proxy = _proxy;
        else {
            this.proxy = "";
        }
        const account_config = this.config['login'][this.oj_name];
        const len = account_config.length;
        account[this.oj_name] = [];
        for (let i = 0; i < len; ++i) {
            account[this.oj_name].push(this.buildJudger(account_config[i]));
        }
        this.loop_function();
        this.timer = setInterval(() => {
            this.loop_function()
        }, 1000);
    }

    stop() {
        clearInterval(this.timer);
    }
}

module.exports = Vjudge_daemon;
