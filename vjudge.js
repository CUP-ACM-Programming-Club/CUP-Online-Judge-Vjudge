const config = require('./config.json');
const VirtualJudge = require('./module/hdujudger');
const hdu_judger=new VirtualJudge(config);

hdu_judger.start();