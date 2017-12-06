const config = require('./config.json');
const Vjudge = require('./module/vjudger');
const submitAnalyse = require('./module/submitAnalyse');
const hdu_judger = new Vjudge(config, "hdu");
const poj_judger = new Vjudge(config, "poj");
const uva_judger = new Vjudge(config, "uva");
const analyse = new submitAnalyse(config);
analyse.start();