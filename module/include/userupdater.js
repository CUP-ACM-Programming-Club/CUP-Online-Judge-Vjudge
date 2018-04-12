const query = require("./mysql_module");

module.exports = function (sid) {
    return new Promise((resolve, reject) => {
        query(`SELECT count(distinct concat(oj_name,problem_id) as accepted from vjudge_solution where result = 4`)
            .then(rows => {
                const accepted = rows[0].accepted;
                query(`select count(distinct concat(oj_name,problem_id) as submit from vjudge_solution`)
                    .then(rows => {
                        const submit = rows[0].submit;
                        query(`update users set vjudge_submit = ?,vjudge_solved = ? where user_id = (select user_id from 
                        vjudge_solution where solution_id = ?)`, [submit, accepted, sid])
                            .then((rows) => {
                                resolve(rows);
                            })
                            .catch(err => {
                                reject(err);
                            })
                    })
                    .catch(err => {
                        reject(err);
                    })
            })
            .catch(err => {
                reject(err);
            })
    })
};