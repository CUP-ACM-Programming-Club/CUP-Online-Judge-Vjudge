const config = require('./config.json');
const VirtualJudge = require('./module/hdujudger');
const submitAnalyse = require('./module/submitAnalyse');
const hdu_judger = new VirtualJudge(config);
const analyse = new submitAnalyse(config);
hdu_judger.start();
analyse.start();