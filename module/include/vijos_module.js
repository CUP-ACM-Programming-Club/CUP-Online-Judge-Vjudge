const language = ["c","cc","cs","pas","java","py"
,"py3","php","rs","hs","js","go","rb"];

exports.formatLanguage = (lang)=>{
	return language[lang] || "cc";
};

exports.formatSubmitUrl = (pid) =>{
	return isNaN(parseInt(pid))?
		`https://vijos.org/d/newbzoj/p/${pid}/submit`
		:
		`https://vijos.org/p/${pid}/submit`
};