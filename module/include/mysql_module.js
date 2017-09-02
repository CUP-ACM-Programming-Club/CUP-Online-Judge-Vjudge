const mysql = require("mysql");
module.exports = function (config) {
    this.query = function (sql_query, sqlArr, callback) {
        const query_back=function(err,rows)
        {
                if (err)
                    console.log(err);
                else if (typeof callback === "function")
                    callback(rows);
        };
        const connection = mysql.createConnection(config['mysql']);
        connection.connect();
        if(typeof sqlArr === "function")
        {
            callback=sqlArr;
            connection.query(sql_query,query_back);
        }
        else {
            connection.query(sql_query,sqlArr,query_back);
        }
        connection.end();
    };
};