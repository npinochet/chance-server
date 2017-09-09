
let maindata = require("./data.json");

let nodemailer = require('nodemailer');
let mailer = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: "nnpinochet@gmail.com",
		pass: "nico1707"
	}
});

var fs = require("fs");

var mongodb = require('mongodb');
var mongo_uri = process.env.MONGODB_URI;



function getLastTime(endtime, until){

	if (until == undefined){
		until = -1;
	}
	
	var t = (Date.parse(endtime) - Date.parse(Date()))*until;
	var seconds = Math.floor( (t/1000) % 60 );
	var minutes = Math.floor( (t/1000/60) % 60 );
	var hours = Math.floor( (t/(1000*60*60)) % 24 );
	var days = Math.floor( t/(1000*60*60*24) );
	return {'total': t,'days': days,'hours': hours,'minutes': minutes,'seconds': seconds};
}

function access(obj, callback){

	getUser(obj.email, (user) =>{
		if (user == false){  //user doesn't exists

			user = newUser(obj);

			mongodb.MongoClient.connect(mongo_uri, (err, db) => {
				if(err) throw err;
				var users = db.collection("users");
				users.insertOne(user, (err, cursor) => {
					if(err) throw err;
					db.close(function (err) {
						if(err) throw err;
					});
				});
			});

		}else{
			user.accessDate = new Date();

			mongodb.MongoClient.connect(mongo_uri, (err, db) => {
				if(err) throw err;
				var users = db.collection("users");
				users.update({"email":user.email}, {$set:{"accessDate":user.accessDate}}, (err, cursor) => {
					if(err) throw err;
					db.close(function (err) {
						if(err) throw err;
					});
				});
			});

		};

		callback(user);

	});

};

function updateData(email, callback){

	let up = {};

	up.jackpot = maindata.jackpot;
	up.resultLimit = maindata.resultLimit;
	up.lastWinner = maindata.lastWinner;

	if (checkLimit(up) == false){
		up = updateData(email, callback);
	};

	if (email != undefined){
		getUser(email, (user) => {
			up.chance = user.chance			
			callback(up);
		});
	}else{
		callback(up);
	};

};

function ad(email, callback){

	getUser(email, (user)=>{

		if (user.lastAd == null || getLastTime(user.lastAd, -1).hours >= 12){
			user.lastAd = new Date();
			user.chance = user.chance+1;

			mongodb.MongoClient.connect(mongo_uri, (err, db) => {
				if(err) throw err;
				var users = db.collection("users");
				users.update({"email":user.email}, {$inc:{"chance":1}, "lastAd":user.lastAd}, (err, cursor) => {
					if(err) throw err;
					db.close(function (err) {
						if(err) throw err;
					});
				});
			});

			callback(user.chance);

		}else{
			callback(false);
		};

	});

};

function getLastTimeAd(email, callback){

	getUser(email, (user)=>{
		let t = getLastTime(user.lastAd, -1);
		if (user.lastAd == "none" || t.hours >= 12){
			callback(true);
		}else{
			callback(Date.parse(Date()) - Date.parse(user.lastAd));
		};

	});
	

};

function newUser(obj){

	let newUser = {};
	newUser.email = obj.email;
	newUser.chance = 0;
	newUser.name = obj.name;
	newUser.displayName = obj.displayName;
	newUser.familyName = obj.familyName;
	newUser.givenName = obj.givenName;
	newUser.id = obj.id;
	newUser.accessDate = new Date();
	newUser.lastAd = null;

	return newUser;

};

function getUser(email, callback){

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if(err) throw err;
		var users = db.collection("users");
		users.find({"email":email}).toArray((err, res) => {
			if(err) throw err;
			if (res.length > 0){
				callback(res[0]);
			}else{
				callback(null);
			};
			db.close(function (err){
				if(err) throw err;
			});
		});
	});
};

function checkLimit(up){

	if (up.jackpot >= up.resultLimit){

		alertWinner();

		maindata.jackpot = maindata.jackpotMin;
		fs.writeFile("data.json", JSON.stringify(maindata), function(err) {
			if (err) {return console.log(err);}
		});

		return false
	}
	return true
};

function alertWinner(){ /////

	//pick a random winner

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if(err) throw err;
		var users = db.collection("users");
		users.aggregate({$sample: {size:1}}).toArray((err, res) => {
			if(err) throw err;
			var winner = res[0];
			db.close(function (err){
				if(err) throw err;
			});

			//send email

			maindata.lastWinner = winner.name+" "+winner.email;
			fs.writeFile("data.json", JSON.stringify(maindata), function(err) {
				if (err) {return console.log(err);}
			});

			let body = JSON.stringify(winner);

			let mailOptions = {
				from: '"Digi Lotto" <node-server@bdigi-lotto.com>',
				to: "n.pinochet@hotmail.com",
				subject: "digi lotto winner",
				text:body+" jackpot:"+maindata.jackpot.toString(),
			};

			mailer.sendMail(mailOptions, (error, info) => {if (error) {return console.log(error);}
				console.log('Message %s sent: %s', info.messageId, info.response);
			});

		});
	});

};

module.exports = {
	"access": access,
	"updateData": updateData,
	"ad":ad,
	"getLastTimeAd":getLastTimeAd
};
