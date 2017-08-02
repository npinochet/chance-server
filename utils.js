
var fs = require("fs");

module.exports = {

	saveFile : function(fileName, body){

		fs.writeFile(fileName, JSON.stringify(body), function(err) {
			if (err) {
				return console.log(err);
			}
		});
	},

	saveDatabase : function(body){

		fs.writeFile("database.json", JSON.stringify(body), function(err) {
			if (err) {
				return console.log(err);
			}
		});
	},

	loadFile: function(fileName){

		var config = require("./"+fileName+".json");
		return config;

	},

	getLastTime: function(endtime, until){

		if (until == undefined){
			until = -1;
		}
		
		var t = (Date.parse(endtime) - Date.parse(Date()))*until;
		var seconds = Math.floor( (t/1000) % 60 );
		var minutes = Math.floor( (t/1000/60) % 60 );
		var hours = Math.floor( (t/(1000*60*60)) % 24 );
		var days = Math.floor( t/(1000*60*60*24) );
		return {'total': t,'days': days,'hours': hours,'minutes': minutes,'seconds': seconds};
	},

	shuffle: function(a) {
		var j, x, i;
		for (i = a.length; i; i--) {
			j = Math.floor(Math.random() * i);
			x = a[i - 1];
			a[i - 1] = a[j];
			a[j] = x;
		}
    },

	
};