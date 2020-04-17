
let maindata = require("./data.json");

let nodemailer = require('nodemailer');
let mailer = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	}
});

var fs = require("fs");

var iap = require('in-app-purchase');
iap.config({
	test: false, // remember to change this
	googlePublicKeyStrSandbox: process.env.GOOGLE_SANDBOX,
	googlePublicKeyStrLive: process.env.GOOGLE_LIVE,
	//googlePublicKeyPath: "path/to/public/key/directory/" // this is the path to the directory containing iap-sanbox/iap-live files
});

var mongodb = require('mongodb');
var mongo_uri = process.env.MONGODB_URI;



function getLastTime(endtime, until){

	if (until == undefined){
		until = -1;
	}
	
	var t = (Date.parse(endtime) - Date.parse(Date()))*until;
	var seconds = Math.floor( (t/1000) );
	var minutes = Math.floor( (t/1000/60) );
	var hours = Math.floor( (t/(1000*60*60)) );
	var days = Math.floor( t/(1000*60*60*24) );
	return {'total': t,'days': days,'hours': hours,'minutes': minutes,'seconds': seconds};
}

function access(obj, callback){

	getUser(obj.email, (user) =>{
		if (user == null){  //user doesn't exists

			user = newUser(obj);
			user.new = true;

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

			user.new = false;

			mongodb.MongoClient.connect(mongo_uri, (err, db) => {
				if(err) throw err;
				var users = db.collection("users");
				users.update({"email":user.email}, {$set:{"accessDate":new Date()}}, (err, cursor) => {
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

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if (err) throw err;
		db.collection("jackpot").findOne({}, (err, res) => {
			if(err) throw err;
			db.collection("winners").findOne({}, (err, win) => {
				if(err) throw err;

				let up = {};

				up.jackpot = res.jackpot;
				up.resultLimit = maindata.resultLimit;
				up.lastWinner = win.lastWinner;
				up.adHours = maindata.adHours;
				up.chance = null;

				checkLimit(up, (bool) => {

					if (bool == false){
						updateData(email, (updat) => callback(updat));
					}else{
						if (email != undefined){
							getUser(email, (user) => {
								if (user != null){
									up.chance = user.chance;
								};
								callback(up);
							});
						}else{
							callback(up);
						};
					};

				});

				db.close((err) => {if (err) throw err;});

			});
		});
	});

};

function ad(email, callback){

	getUser(email, (user)=>{

		if (user.lastAd == null || getLastTime(user.lastAd, -1).hours >= maindata.adHours){

			//add amount to jackpot
			updateJackpot(false, maindata.adCost, null);

			mongodb.MongoClient.connect(mongo_uri, (err, db) => {
				if(err) throw err;
				var users = db.collection("users");
				users.update({"email":user.email}, {$inc:{"chance":1}, $set:{"lastAd":new Date()}}, (err, cursor) => {
					if(err) throw err;
					db.close(function (err) {
						if(err) throw err;
					});
					callback(true);
				});
			});

		}else{
			callback(false);
		};

	});

};

function getLastTimeAd(email, callback){

	getUser(email, (user)=>{
		if (user != null){
			let t = getLastTime(user.lastAd, -1);
			if (user.lastAd == null || t.hours >= maindata.adHours){
				callback(null);
			}else{
				let elapsed = Date.parse(Date()) - Date.parse(user.lastAd);
				let remain = maindata.adHours*(1000*60*60) - elapsed;
				callback(remain);
			};
		}else{
			callback(null);
		};
	});
};

function confirmBuy(email, details, item, callback){

	iap.setup(function (error) {
		if (error) {
			// Don't forget to catch error here
			console.log("Error IAP Setup buy: "+error);
			callback(false);
		};
		// As of v1.4.0+ .validate and .validateOnce detects service automatically from the receipt
		iap.validate({"data":details.receiptData, "signature":details.receiptSignature}, function (error, response) {
			if (error) {
				// Failed to validate
				console.log("Error Validating buy: "+error);
				callback(false);
			};
			if (iap.isValidated(response)) {

				//add amount to jackpot
				let price = item.priceValue*100;

				///////// legacy Chilean Pesos, CLP => USD
				if (item.currency == "CLP"){
					price = item.priceValue/5;
				};
				/////////legacy

				updateJackpot(false, Math.floor(price), null);

				//Succuessful validation change chance in mongo

				mongodb.MongoClient.connect(mongo_uri, (err, db) => {
					if(err) throw err;
					var users = db.collection("users");
					users.update({"email":email}, {$inc:{"chance":parseInt(item.productId)}}, (err, cursor) => {
						if(err) throw err;
						db.close(function (err) {
							if(err) throw err;
						});
						callback(true);
					});
				});

			}else{
				callback(false);
			};
		});
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

function updateJackpot(set, value, callback){

	let update = {$inc:{"jackpot":value}};
	if (set){
		update = {$set:{"jackpot":value}};
	};
	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if (err) throw err;
		db.collection("jackpot").updateOne({}, update, (err, cursor) => {
			if(err) throw err;
			db.close((err) => {if (err) throw err;});
			if (callback) {callback();};
		});
	});
};

function checkLimit(up, callback){

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if (err) throw err;
		db.collection("jackpot").findOne({}, (err, res) => {
			if(err) throw err;

			if (res.jackpot >= up.resultLimit){
				alertWinner(res.jackpot);
				updateJackpot(true, maindata.jackpotMin, () => callback(false));
			}else{
				callback(true);
			};

			db.close((err) => {if (err) throw err;});
		});
	});

};

function alertWinner(jackpot){ /////

	console.log("Alert Winner");

	function selectWeightedRandom(elements, total) {
		let randNum = Math.random()*total;
		for (const { email, chance } of elements) {
			if (randNum < chance) {
				return email;
			};
			randNum -= chance;
		};
	};

	//pick a random winner

	mongodb.MongoClient.connect(mongo_uri, (err, db) => {
		if(err) throw err;
		var users = db.collection("users");

		users.aggregate([{$group:{_id:null, totalChance:{$sum:"$chance"}, count:{$sum:1}}}], (err, result) => {
			if(err) throw err;
			let res = result[0];

			users.find({"chance":{$gt:0}}, {"email":1, "chance":1}).toArray((err, weights) => {
				if(err) throw err;

				let winner = selectWeightedRandom(weights, res.totalChance);

				users.find({"email":winner}).toArray((err, user) => {
					if(err) throw err;

					//send email

					db.collection("winners").updateOne({}, {$set:{"lastWinner":user[0].name}}, (err, cursor) => {
						if(err) throw err;
						db.close((err) => {if (err) throw err;});
					});

					let body = "Winner: "+user[0].name+
					"\nEmail: "+user[0].email+
					"\nJackpot: $"+(jackpot/100).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')+
					"\nChanceSum: "+res.totalChance+
					"\nUsersThatParticipated: "+res.count+
					"\nDataWinner: "+JSON.stringify(user[0]);

					let mailOptions = {
						from: '"Chance" <nicofox77@gmail.com>',
						to: "n.pinochet@hotmail.com",
						subject: "Chance Lotto Winner",
						text: body,
					};

					mailer.sendMail(mailOptions, (error, info) => {
						if (error) {return console.log(error)};
						console.log('Message %s sent: %s', info.messageId, info.response);
					});


					db.close(function (err){
						if(err) throw err;
					});

				});

			});
		});
	});

};

module.exports = {
	"access": access,
	"updateData": updateData,
	"ad":ad,
	"getLastTimeAd":getLastTimeAd,
	"confirmBuy":confirmBuy,
};
