const mysql = require("mysql");

module.exports=function(config,sqlArr)
{
    const connection = mysql.createConnection(config['mysql']);
    connection.connect(function(){});
    connection.query("update vjudge_solution set runner_id=?,result=?,time=?,memory=? where solution_id=?",sqlArr, async function (err, rows, fields) {
        if(err)
            console.log(err);
    });
    connection.end(function(){});
};