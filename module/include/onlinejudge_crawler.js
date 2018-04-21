const superagent = require('superagent');
require('superagent-proxy')(superagent);
const cheerio = require('cheerio');
const querystring = require('querystring');
const query = require('./mysql_module');
const functional_module = require('./functional');
const functional = new functional_module();
const sleep = functional.sleep;
let proxy = "";
let uva = [];
module.exports = function (accountArr, config) {
	if (typeof config['proxy'] !== 'undefined' && typeof  config['proxy'] !== null)
		proxy = config['proxy'];
	const save_to_database = async (oj_name, arr) => {
		if (typeof arr === 'undefined' || arr.length === 0) return;
		query("SELECT * FROM vjudge_record WHERE user_id=? and oj_name=?", [accountArr['user_id'], oj_name])
			.then(async (rows) => {
				let list = [];
				for (i in rows) {
					list[rows[i].problem_id] = 1;
				}
				for (i in arr) {
					if (typeof arr[i] !== "undefined" && arr[i].toString().length > 0 && (typeof list === 'undefined' || typeof list[arr[i]] === 'undefined')) {
						await query("INSERT INTO vjudge_record(user_id,oj_name,problem_id,time)VALUES(?,?,?,NOW())",
							[accountArr['user_id'], oj_name, arr[i]]);
						await sleep(10);
					}
				}
			});
	};

	const hduAction = async function (err, response) {
		if (err || !response.ok) {
			console.log("HDUAction:Some error occured in response.");
		}
		else {
			const $ = cheerio.load(response.text);
			let arr = $('table').find('table').eq(2).find('script').eq(0).html().split(';');
			for (i in arr) {
				arr[i] = arr[i].substring(arr[i].indexOf('(') + 1, arr[i].indexOf(','));
			}
			save_to_database('HDU', arr);
		}
	};

	const hdu_crawler = (account) => {
		if (proxy.length > 4)
			superagent.get("http://acm.hdu.edu.cn/userstatus.php?user=" + account).proxy(proxy).set(config['browser']).end(hduAction);
		else
			superagent.get("http://acm.hdu.edu.cn/userstatus.php?user=" + account).set(config['browser']).end(hduAction);
	};

	const pojAction = async function (err, response) {
		if (err || !response.ok) {
			console.log("POJAction:Some error occured in response.");
		}
		else {
			const $ = cheerio.load(response.text);
			let js = $("script");
			js = js.eq(1).html();
			js = js.substring(js.indexOf('}') + 1, js.length).split('\n');
			for (i in js) {
				js[i] = js[i].substring(js[i].indexOf('(') + 1, js[i].indexOf(')'));
			}
			save_to_database('POJ', js);
		}
	};

	const poj_crawler = (account) => {
		if (proxy.length > 4)
			superagent.get("http://poj.org/userstatus?user_id=" + account).proxy(proxy).set(config['browser']).end(pojAction);
		else
			superagent.get("http://poj.org/userstatus?user_id=" + account).set(config['browser']).end(pojAction);
	};

	const codeforcesAction = async function (err, response) {
		if (err || !response.ok) {
			console.log("CodeForceAction:Some error occured in response.");
		}
		else {
			const json = JSON.parse(response.text)['result'];
			let arr = [];
			for (i in json) {
				if (json[i]['verdict'] === 'OK') {
					let problem_id = json[i]['problem'];
					problem_id = problem_id['contestId'] + problem_id['index'];
					arr.push(problem_id);
				}
			}
			save_to_database('CODEFORCES', arr);
		}
	};

	const codeforces_crawler = (account) => {
		if (proxy.length > 4)
			superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=1000").set(config['browser']).proxy(proxy).end(codeforcesAction);
		else
			superagent.get("http://codeforces.com/api/user.status?handle=" + account + "&from=1&count=1000").set(config['browser']).end(codeforcesAction);
	};

	const uvaAction = async function (err, response) {
		if (err || !response.ok) {
			console.log("UVAAction:Some error occured in response.");
		}
		else {
			const json = JSON.parse(response.text)["subs"];
			let arr = [];
			for (i in json) {
				if (90 === parseInt(json[i][2])) {
					let problem_id = uva[json[i][1]];
					arr.push(problem_id);
				}
			}
			save_to_database('UVa', arr);
		}
	};

	const uva_convert_username_to_id = async function (err, response) {
		if (err || !response.ok) {
			console.log("UVA_convert:Some error occured in response.");
		}
		else {
			if (proxy.length > 4)
				superagent.get("https://uhunt.onlinejudge.org/api/subs-user/" + response.text).set(config['browser']).proxy(proxy).end(uvaAction);
			else
				superagent.get("https://uhunt.onlinejudge.org/api/subs-user/" + response.text).set(config['browser']).end(uvaAction);
		}

	};

	const uva_crawler = (account) => {
		if (proxy.length > 4)
			superagent.get("https://uhunt.onlinejudge.org/api/uname2uid/" + account).set(config['browser']).proxy(proxy).end(uva_convert_username_to_id);
		else
			superagent.get("https://uhunt.onlinejudge.org/api/uname2uid/" + account).set(config['browser']).end(uva_convert_username_to_id);

	};

	const vjudgeAction = function (err, response) {
		if (err || !response.ok) {
			console.log("VjudgeAction:Some error occured in response.");
		}
		else {
			const json = (JSON.parse(response.text))['acRecords'];
			const hdu = json['HDU'];
			const poj = json['POJ'];
			const codeforces_gym = json['Gym'];
			const codeforces = json['CodeForces'];
			const uva = json['UVA'];
			const uvalive = json['UVALive'];
			const fzu = json['FZU'];
			const aizu = json['Aizu'];
			const csu = json['CSU'];
			const hysbz = json['HYSBZ'];
			const spoj = json['SPOJ'];
			const uestc = json['UESTC'];
			const ural = json['URAL'];
			const zoj = json['ZOJ'];
			const kattis = json['Kattis'];
			save_to_database('HDU', hdu);
			save_to_database('POJ', poj);
			save_to_database('CODEFORCES', codeforces);
			save_to_database('CODEFORCES_GYM', codeforces_gym);
			save_to_database('UVA', uva);
			save_to_database('UVALive', uvalive);
			save_to_database('FZU', fzu);
			save_to_database('Aizu', aizu);
			save_to_database('CSU', csu);
			save_to_database('HYSBZ', hysbz);
			save_to_database('SPOJ', spoj);
			save_to_database('UESTC', uestc);
			save_to_database('URAL', ural);
			save_to_database('ZOJ', zoj);
			save_to_database('Kattis', kattis);
		}
	};

	const vjudge_crawler = (account) => {
		if (proxy.length > 4)
			superagent.get("https://cn.vjudge.net/user/solveDetail/" + account).set(config['browser']).proxy(proxy).end(vjudgeAction);
		else
			superagent.get("https://cn.vjudge.net/user/solveDetail/" + account).set(config['browser']).end(vjudgeAction);
	};

	const hustoj_upcAction = async function (err, response) {
		if (err || !response.ok) {
			console.log("HUSTOJ_UPCAction:Some error occured in response.");
		}
		else {
			const $ = cheerio.load(response.text);
			let plaintext = $("table").find('script').eq(0).html();
			plaintext = plaintext.substring(plaintext.indexOf('}\n') + 1, plaintext.length).split(';');
			for (i in plaintext) {
				plaintext[i] = plaintext[i].substring(plaintext[i].indexOf('(') + 1, plaintext[i].indexOf(')'));
				if(plaintext[i].indexOf(",") !== -1)
				{
					plaintext[i] = plaintext[i].substring(0,plaintext[i].indexOf(","));
				}
			}
			save_to_database('HUSTOJ_UPC', plaintext);
		}
	};


	const hustoj_upc_crawler = (account) => {
		//  console.log(account);
		if (proxy.length > 4)
			superagent.get("http://exam.upc.edu.cn/userinfo.php?user=" + account).set(config['browser']).proxy(proxy).end(hustoj_upcAction);
		else
			superagent.get("http://exam.upc.edu.cn/userinfo.php?user=" + account).set(config['browser']).end(hustoj_upcAction);
	};

	const upcvjAction = function (err, response) {
		if (err || !response.ok) {
			console.log("UPCVjudgeAction:Some error occured in response.");
		}
		else {
			let json = JSON.parse(response.text)['data'];
			let hdu = [];
			let hducnt = 0;
			let poj = [];
			let pojcnt = 0;
			for (i in json) {
				if (json[i][11] === 'HDU')
					hdu[hducnt++] = json[i][12];
				else if (json[i][11] === 'POJ')
					poj[pojcnt++] = json[i][12];
			}
			save_to_database('HDU', hdu);
			save_to_database('POJ', poj);
		}
	};

	const upcvj = (account) => {
		const postData = {
			un: account
		};
		const vjurl = "http://exam.upc.edu.cn:8080/vjudge/problem/fetchStatus.action?draw=2&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=false&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=false&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=5&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=false&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=6&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=false&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=7&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=false&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=8&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=false&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B9%5D%5Bdata%5D=9&columns%5B9%5D%5Bname%5D=&columns%5B9%5D%5Bsearchable%5D=true&columns%5B9%5D%5Borderable%5D=false&columns%5B9%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B9%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B10%5D%5Bdata%5D=10&columns%5B10%5D%5Bname%5D=&columns%5B10%5D%5Bsearchable%5D=true&columns%5B10%5D%5Borderable%5D=false&columns%5B10%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B10%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B11%5D%5Bdata%5D=11&columns%5B11%5D%5Bname%5D=&columns%5B11%5D%5Bsearchable%5D=true&columns%5B11%5D%5Borderable%5D=false&columns%5B11%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B11%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=0&order%5B0%5D%5Bdir%5D=desc&start=0&length=1000&search%5Bvalue%5D=&search%5Bregex%5D=false&" + querystring.stringify(postData) + "&OJId=All&probNum=&res=1&language=&orderBy=run_id";
		if (proxy.length > 4)
			superagent.get(vjurl).proxy(proxy).set(config['browser']).end(upcvjAction);
		else
			superagent.get(vjurl).set(config['browser']).end(upcvjAction);
	};

	const crawler_match = {
		"hdu": hdu_crawler,
		"poj": poj_crawler,
		"codeforces": codeforces_crawler,
		"uva": uva_crawler,
		"vjudge": vjudge_crawler,
		"hustoj-upc": hustoj_upc_crawler,
		"upcvj": upcvj
	};

	const uAction = (err, response) => {
		if (err) return;
		const res = JSON.parse(response.text);
		for (i in res) {
			uva[res[i][0]] = res[i][1];
		}
	};

	const uva_to = () => {
		if (proxy.length > 4)
			superagent.get("https://uhunt.onlinejudge.org/api/p").set(config['browser']).proxy(proxy).end(uAction);
		else
			superagent.get("https://uhunt.onlinejudge.org/api/p").set(config['browser']).end(uAction);
	};
	const crawler = () => {
		for (const value in accountArr) {
			if (value === 'user_id') continue;
			if (accountArr[value] !== null) crawler_match[value](accountArr[value]);
		}
	};
	this.run = () => {
		uva_to();
		crawler();
	};
};