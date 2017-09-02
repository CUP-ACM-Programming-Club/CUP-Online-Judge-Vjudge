const mysql_module = require('./include/mysql_module');
const sleep_module = require('./include/functional');
const sleep = new sleep_module();
const log = console.log;
const crawler_module = require('./include/onlinejudge_crawler');
module.exports = function (config) {
    const mysql = new mysql_module(config);

    const crawler = (accountArr) => {
        log("crawling:");
        log("user_id:" + accountArr['user_id']);
        const _crawler = new crawler_module(accountArr, config);
        _crawler.run();
    };

    const prepare = () => {
        mysql.query("SELECT * FROM users_account", function (rows) {
            for (i in rows) {
                crawler(rows[i]);
                sleep.sleep(10000);
            }
        });
    };

    this.start = () => {
        prepare();
        this.timer = setInterval(prepare, 1000 * 60 * 10);
    };
    this.stop = () => {
        clearInterval(this.timer);
    }
};