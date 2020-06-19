var express = require('express');
var router = express.Router();

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
    let dbData = await checkLastUpdateDateTable();
    if (dbData.Item.crawlingstatus == true) {
        res.redirect('http://ec2-54-255-199-236.ap-southeast-1.compute.amazonaws.com:8080/');
    }else {
        MakeDownload.makejson(req, res);
    }
});
async function checkLastUpdateDateTable() {
    try {
        var params = {
            TableName: 'LastUpdateDate',
            Key: {
                'No': 1
            },
        };
        let data = await docClient.get(params).promise();
        return data;
    } catch (err) {
        console.log(err);
    }
}
module.exports = router;