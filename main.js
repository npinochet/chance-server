
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

	sys.ad(req.query.email, (date)=>{
		res.json({"date":date});
	});

});


app.get("/update",function(req, res){

	if (req.query.email != undefined){
		console.log("accessed: /update "+req.query.email);
	}else{
		console.log("accessed: /update");
	};

	sys.updateData(req.query.email, (up)=>{
		res.json(up);
	});

});

app.get("/lastTimeAd",function(req, res){

	console.log("accessed: /lastTimeAd "+req.query.email);

	sys.getLastTimeAd(req.query.email, (mili) =>{
		res.json({"mili":mili});
	});

});

app.post("/login", function(req, res){

	console.log("accessed: /login "+req.body.email);

	sys.access(req.body, (user) => {
		up = sys.updateData(null, (up)=>{
			up.chance = user.chance;
			up.new = user.new;
			res.json(up);
		});
	});
	
});

app.post("/buy", function(req, res){

	console.log("accessed: /buy "+req.body.email+" "+req.body.item.product_id);

	sys.confirmBuy(req.body.email, req.body.details, req.body.item, (confrimed) =>{
		res.json(confrimed);
	});
	
});

app.listen(port,null,function(){ 
	console.log('%s: Node server started on %s:%d.', Date(Date.now()), os.hostname(), port);
});
