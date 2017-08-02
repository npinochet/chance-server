
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

var mongo = require('mongodb');
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

function access(obj){

	let user = getUser(obj.email);

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
	};

	return user;

};

function updateData(email){

	let up = {};

	up.jackpot = maindata.jackpot;
	up.resultLimit = maindata.resultLimit;
	up.lastWinner = maindata.lastWinner;

	if (email != undefined){
		var user = getUser(email);
		up.chance = user.chance
	};

	if (checkLimit(up) == false){
		up = updateData(email);
	};

	return up

};

function ad(email){

	var user = getUser(email);

	if (user.lastAd == "none" || getLastTime(user.lastAd, -1).hours >= 12){
		user.lastAd = new Date();
		user.chance = user.chance+1;

		mongodb.MongoClient.connect(mongo_uri, (err, db) => {
			if(err) throw err;
			var users = db.collection("users");
			users.update({"email":user.email}, {$inc:{"chance":1}}, (err, cursor) => {
				if(err) throw err;
				db.close(function (err) {
					if(err) throw err;
				});
			});
		});

		return user.chance
	}else{
		return false
	};

};

function getLastTimeAd(email){

	let user = getUser(email);
	let t = getLastTime(user.lastAd, -1);

	if (user.lastAd == "none" || t.hours >= 12){
		return true
	}else{
		return (Date.parse(Date()) - Date.parse(user.lastAd));
	};

};

function newUser(obj){

	let newUser = {};
	newUser.email = obj.email;
	newUser.chance = 0;
	newUser.displayName = obj.displayName;
	newUser.familyName = obj.familyName;
	newUser.givenName = obj.givenName;
	newUser.accessDate = new Date();
	newUser.lastAd = "none";

	return newUser;

};

function getUser(email){

	var user = false;

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if(err) throw err;
		var users = db.collection("users");
		users.find({"email":email}).toArray((err, res) => {
			if(err) throw err;
			if (res.length > 0){
				user = res[0];
			};
			db.close(function (err) {
				if(err) throw err;
			});
		});
	});

	return user;
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

	var winner;

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if(err) throw err;
		var users = db.collection("users");
		users.aggregate({$sample: {size:1}}).toArray((err, res) => {
			if(err) throw err;
			winner = res[0];
			db.close(function (err){
				if(err) throw err;
			});
		});
	});

	//send email

	maindata.lastWinner = winner.givenName+" "+winner.familyName+" "+winner.email;
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

};

module.exports = {
	"access": access,
	"updateData": updateData,
	"ad":ad,
	"getLastTimeAd":getLastTimeAd
};
