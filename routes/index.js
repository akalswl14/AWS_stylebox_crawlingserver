var express = require('express');
var router = express.Router();
var fs = require('fs');

var Crawling = require('./crawling');
var MakeDownload = require('./MakeDownloadJson');

router.get('/firstcrawling', function (req, res) {
    try {
        Crawling.runcrawling(req, res);
    } catch (err) {
        console.log(err);
        res.send({ type: 'error', error: err });
    }
});
router.post('/downloadfeed', function (req, res) {
    console.log('downloading feed!');
    console.log(req.body);
    var par = JSON.parse(fs.readFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json', 'utf8'));
    if (par['crawlingstatus'] == true) {
        res.redirect('http://localhost:3000/');
    } else {
        MakeDownload.makejson(req, res);
    }
});

module.exports = router;