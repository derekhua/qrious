var app = require('express')();
var server = require('http').Server(app);
var bodyParser = require('body-parser')
var Promise = require('promise');
var twilio = require('twilio');
var wolfram = require('wolfram').createClient("TKP9V8-V4KP6P5PKL");

var accountSid = 'AC466b9301d8e9cefd4c841794be11d77a';
var authToken = '430f808373847f0f46f9c7ed35ef3533';
var client = require('twilio')(accountSid, authToken);

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
// Parse application/json
app.use(bodyParser.json({limit: '50mb'}));

// For cross-domain requests
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Authorization");
  next();
});

app.post('/',function(req, res) {
  var resp = new twilio.TwimlResponse();

  wolfram.query(req.body.Body, function(err, result) {
    if(err) {
      console.log(err);
    }
    else {
      var resultString = "";
      var pods = Math.min(result.length, 2);
      for (var i = 0; i < pods; i++) {
        resultString += "[" + result[i].title + "]\n";
        for (var j = 0; j < result[i].subpods.length; j++) {
          if (result[i].subpods[j].value.length > 0) {
            resultString += result[i].subpods[j].value;
          }
          else {
            resultString += result[i].subpods[j].image;
          }
        }
        resultString += "\n\n";
      }
    }
    resp.message("Result: " + resultString);    
    res.writeHead(200, {
      'Content-Type':'text/xml'
    });
    res.end(resp.toString());
  });
});

server.listen(3000, function(){
  console.log('listening on *:3000');
});