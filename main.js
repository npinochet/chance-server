
var app = require('express')();
var bodyParser = require('body-parser');
var os = require("os");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var port = process.env.PORT || 3000;


sys = require("./system.js");

app.get("/",function(req, res){

	console.log("accessed: /");
	res.send("hello")

});

app.get("/ad",function(req, res){

	console.log("accessed: /ad "+req.query.email);

	let chance = sys.ad(req.query.email);
	res.json({"chance":chance});

});


app.get("/update",function(req, res){

	if (req.query.email != undefined){
		console.log("accessed: /update "+req.query.email);
	}else{
		console.log("accessed: /update");
	};

	up = sys.updateData(req.query.email);
	res.json(up);

});

app.get("/lastTimeAd",function(req, res){

	console.log("accessed: /lastTimeAd "+req.query.email);

	mili = sys.getLastTimeAd(req.query.email);
	res.json({"mili":mili});

});

app.post("/login", function(req, res){

	console.log("accessed: /login "+req.body.email);

	user = sys.access(req.body);
	up = sys.updateData();

	up.chance = user.chance;

	res.json(up);

});

app.listen(port,null,function(){ 
	console.log('%s: Node server started on %s:%d.', Date(Date.now()), os.hostname(), port);
});


