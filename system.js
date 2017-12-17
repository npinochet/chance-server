
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

var iap = require('in-app-purchase');
iap.config({
	test: true, // remember to change this
	googlePublicKeyStrSandbox: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn2euc1TChqRQ3C0Rtk8v4n9DldUFwAV++UWdgj4OIx7OOY/HE5YT42V7rRUcKGn+IrWVs/qiRXvLyFUUqeK9u/+KUet7Mz/j7Cl/5iE+u6lai/gvQlA9159ELREZpOX8ShdT1Bu9B3ej3iZYse+vO7UbmTOBr5V54fW3roMkOpiXbqwFCFsFf1aCQ43EAYzcwxJFVVElOyP229ALPyvO1cFHrs9BbRAd++fS7iEYkUi+p/cacnJ4w9MZqzDkfjZu6U4s8Dg2LKD4KTdex5e3NXLa3fmC3UPlud9Mt4jQG7Oiop6y752h2ePrSFpPIGY0XybEgg6VLl8mS2ssRY44RwIDAQAB",
	googlePublicKeyStrLive: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn2euc1TChqRQ3C0Rtk8v4n9DldUFwAV++UWdgj4OIx7OOY/HE5YT42V7rRUcKGn+IrWVs/qiRXvLyFUUqeK9u/+KUet7Mz/j7Cl/5iE+u6lai/gvQlA9159ELREZpOX8ShdT1Bu9B3ej3iZYse+vO7UbmTOBr5V54fW3roMkOpiXbqwFCFsFf1aCQ43EAYzcwxJFVVElOyP229ALPyvO1cFHrs9BbRAd++fS7iEYkUi+p/cacnJ4w9MZqzDkfjZu6U4s8Dg2LKD4KTdex5e3NXLa3fmC3UPlud9Mt4jQG7Oiop6y752h2ePrSFpPIGY0XybEgg6VLl8mS2ssRY44RwIDAQAB",
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

			let up = {};

			up.jackpot = res.jackpot;
			up.resultLimit = maindata.resultLimit;
			up.lastWinner = maindata.lastWinner;
			up.adHours = maindata.adHours;
			up.chance = null;

			if (checkLimit(up, (bool => {

				if (bool == false){
					up = updateData(email, callback);
				};

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

			}));

			db.close((err) => {if (err) throw err;});
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
				updateJackpot(false, item.cost, null);

				//Succuessful validation change chance in mongo

				mongodb.MongoClient.connect(mongo_uri, (err, db) => {
					if(err) throw err;
					var users = db.collection("users");
					users.update({"email":email}, {$inc:{"chance":item.multi}}, (err, cursor) => {
						if(err) throw err;
						db.close(function (err) {
							if(err) throw err;
						});
						callback(true);
					});
				});

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
				updateJackpot(true, main.jackpotMin, () => {
					callback(false);
				});
			}else{
				callback(true);
			};

			db.close((err) => {if (err) throw err;});
		});
	});

};

function alertWinner(jackpot){ /////

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
				subject: "Digi Lotto Winner",
				text:body+" jackpot: "+jackpot.toString(),
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
	"getLastTimeAd":getLastTimeAd,
	"confirmBuy":confirmBuy,
};
