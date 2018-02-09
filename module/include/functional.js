module.exports = function () {
    this.sleep = function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };
    this.sleepMinute = (minute)=>{
        return new Promise((resolve)=>this.sleep(minute*60*1000).then(resolve));
    };
    this.sleepSecond = (second)=>{
        return new Promise((resolve)=>this.sleep(second*1000).then(resolve));
    };
    this.sleepHour = (hour)=>{
        return new Promise((resolve)=>this.sleepMinute(hour*60).then(resolve));
    }
};