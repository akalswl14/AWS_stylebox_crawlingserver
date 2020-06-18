var express = require('express');
var bodyParser = require('body-parser');
var indexRouter = require('./routes/index');

var app = express();
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use('/', indexRouter);

const server = app.listen(3001, function () {
    console.log('Connected 3001 port!')
});