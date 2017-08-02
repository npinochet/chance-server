
let nodemailer = require('nodemailer');

let mailer = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: "nnpinochet@gmail.com",
		pass: "nico1707"
	}
});


let utils = require("./utils.js");

let database = require("./database.json");
let maindata = require("./data.json");

var threadLock = false;



function access(obj){

	let user = getUser(obj.email);

	if (user == false){ // user doesn't exists

		user = newUser(obj);
		database.push(user);
		utils.saveDatabase(database);

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
		up = updateData();
	};

	return up

};

function ad(email){

	var user = getUser(email);

	if (user.lastAd == "none" || utils.getLastTime(user.lastAd, -1).days >= 1){
		user.lastAd = new Date();
		user.chance = user.chance+1;
		utils.saveDatabase(database);
		return user.chance
	}else{
		return false
	};

};

function getLastTimeAd(email){

	let user = getUser(email);
	let t = utils.getLastTime(user.lastAd, -1);

	if (user.lastAd == "none" || t.days >= 1){
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

	let l = database.length;
	for (var i = 0; i < l; i++) {
		if (database[i].email == email){
			return database[i];
		};
	};

	return false;

};

function checkLimit(up){

	if (up.resultLimit < 0){ // Date Due
		if (threadLock == false){
			threadLock = true;

			//change date
			let date = new Date();
			date.setDate(1);
			date.setMonth(date.getMonth()+1);

			alertWinner();

			maindata.jackpot = 20000;
			maindata.resultLimit = date;
			utils.saveFile("data.json", maindata);

			threadLock = false;
			return false
		}
	}
	return true
};

function alertWinner(){

	//pick a random winner

	let world = [];

	let l = database.length;
	for (var i = 0; i < l; i++) {
		for (var y = 0; y < database[i].chance; y++){
			world.push(database[i].email);
		};
	};

	utils.shuffle(world);

	let winnerEmail = world[Math.floor(Math.random()*world.length)];

	let winner = getUser(winnerEmail);

	//send email

	maindata.lastWinner = winner.givenName+" "+winner.familyName;

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
	"getLastTimeAd":getLastTimeAd,
};
