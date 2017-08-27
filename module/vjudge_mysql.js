const mysql = require("mysql");

module.exports = function (config) {
    this.query = function (sql_query, sqlArr, callback) {
        const connection = mysql.createConnection(config['mysql']);
        connection.connect(function () {
        });
        connection.query(sql_query, sqlArr, async function (err, rows, fields) {
            if (err)
                console.log(err);
            else if (typeof callback === "function")
                callback(rows);
        });
        connection.end(function () {
        });
    };
};