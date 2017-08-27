const mysql = require("mysql");

module.exports=function(config)
{
    const query=function(sql_query,sqlArr,callback)
    {
        const connection = mysql.createConnection(config['mysql']);
        connection.connect(function(){});
        connection.query(sql_query,sqlArr, async function (err, rows, fields) {
            if(err)
                console.log(err);
            else
                callback(rows);
        });
        connection.end(function(){});
    };
};