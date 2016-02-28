var app = require('express')();
var server = require('http').Server(app);
var bodyParser = require('body-parser');
var twilio = require('twilio');
var wolfram = require('wolfram').createClient("TKP9V8-V4KP6P5PKL");
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;  

var accountSid = 'AC466b9301d8e9cefd4c841794be11d77a';
var authToken = '430f808373847f0f46f9c7ed35ef3533';
var client = require('twilio')(accountSid, authToken);
var vision = require('node-cloud-vision-api');
var db = new Db('qrious', new Server('ds047632.mlab.com', '47632'));
var collectionName = "results";
vision.init({auth: 'AIzaSyC5WZaW1eYHseVXKaPTO62SkJplhsYN9ew'})

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

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement);
};


function wolframQuery(str, res, twil, phone) {
  wolfram.query(str, function(err, result) { 
    var text = "";
    var images = [];

    if(err) {
      console.log(err);
    }
    else {     
      var pods = Math.min(result.length, 2);
      for (var i = 0; i < pods; i++) {
        text += '\n--------------------------\n' + result[i].title + ':\n--------------------------\n'
        for (var j = 0; j < result[i].subpods.length; j++) {
          if (result[i].subpods[j].value) {         
            var replaced = result[i].subpods[j].value.replaceAll("|", "\t");   
            text += replaced;
          } else {
            images.push(result[i].subpods[j].image);            
          }          
        }
      }
    }    

    twil.message(function() {
      console.log(text);
      console.log(images);
      var temp = this.body(text);
      for (var i = 0; i < images.length; ++i) {
        temp = temp.media(images[i]);        
      }      
    });

    db.collection(collectionName).updateOne({'phone' : phone}, {'phone' : phone, 'results' : result, 'index' : Math.min(result.length, 2)}, { upsert: true }, function(err) {
      if (err) {
        console.log(err);
      }
    });
    // twil.message(text);

    res.send(twil.toString());
  });
};



app.post('/',function(req, res) {
  var twil = new twilio.TwimlResponse();
  var phone = req.body.From;
  if (req.body.Body.toLowerCase().trim() === 'more') {
    var cursor = db.collection(collectionName).find({'phone' : phone});
    cursor.each(function(err, doc) {
      if (err) {
        console.log(err)
      }
      else if (doc !== null) {
        var text = "";
        var images = [];
        console.log(doc.results);
        
        if (doc.index < doc.results.length) {
          text += '\n--------------------------\n' + doc.results[doc.index ].title + ':\n--------------------------\n';
          for (var j = 0; j < doc.results[doc.index].subpods.length; j++) {
            if (doc.results[doc.index].subpods[j].value) {
              var replaced = doc.results[doc.index].subpods[j].value.replaceAll("|", "\t");   
              text += replaced;
            } else {
              images.push(doc.results[doc.index].subpods[j].image);            
            }          
          }
        }
        else {
          text = "No more information";
        }
        
        twil.message(function() {
          console.log(text);
          console.log(images);
          var temp = this.body(text);
          for (var i = 0; i < images.length; ++i) {
            temp = temp.media(images[i]);        
          }      
        });

        db.collection(collectionName).updateOne({'phone' : phone}, {$inc : {'index' : 1}}, { upsert: true }, function(err) {
          if (err) {
            console.log(err);
          }
        });

        res.send(twil.toString());
      }
    });
  }
  else {
    // Image
    if (req.body.MediaUrl0) {
      // construct parameters
      var req = new vision.Request({
        image: new vision.Image({
          url: req.body.MediaUrl0
        }),
        features: [        
          new vision.Feature('LABEL_DETECTION', 1),
        ]
      });

      // send single request
      vision.annotate(req).then(function(response) {
        // handling response
        console.log(response.responses[0].labelAnnotations[0].description);
        wolframQuery(response.responses[0].labelAnnotations[0].description, res, twil, phone);
      }, function(e) {
        console.log('Error: ', e);
      });
    } 
    else {
      wolframQuery(req.body.Body, res, twil, phone);
    }
  }
});

server.listen(3000, function(){
  console.log('listening on *:3000');
  db.open(function(err, db) {
    db.authenticate('qrious-admin', 'lobster897', function(err, result) { 
      if (err) {
        console.log(err);
      }
      else {
        console.log("Connected to mongodb");
      }
    });  
  }); 
});