const mysql = require("mysql2");
const config = require('../../config.json');
const connection = mysql.createConnection(config['mysql']);
const query = function (sql_query, sqlArr, callback) {
    if (typeof callback === "function") {
        connection.query(sql_query, sqlArr, function (err, results, fields) {
            callback(results);
        })
    }
    else {
        return new Promise((resolve, reject) => {
            connection.query(sql_query, sqlArr, function (err, results, fields) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(results);
                }
            })
        })
    }
    //connection.end();
};
module.exports = query;