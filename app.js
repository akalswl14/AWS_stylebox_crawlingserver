var express = require('express');
var bodyParser = require('body-parser');
var indexRouter = require('./routes/index');

var app = express();
app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
// app.use(function(req, res, next) {
//     res.header('Access-Control-Allow-Origin', 'http://ec2-54-255-199-236.ap-southeast-1.compute.amazonaws.com');
//     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//     res.header('Access-Control-Allow-Headers', '*');
//     next();
//   });
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use('/', indexRouter);

const server = app.listen(8080, function () {
    console.log('Connected 8080 port!')
});
