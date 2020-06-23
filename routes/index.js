var express = require('express');
var router = express.Router();

var Crawling = require('./crawling');
var MakeDownload = require('./MakeDownloadJson');
var AWS = require('aws-sdk');
AWS.config.update({
    region: 'ap-southeast-1'
})
var s3 = new AWS.S3();


router.get('/firstcrawling', function (req, res) {
    try {
        Crawling.runcrawling(req, res);
    } catch (err) {
        console.log(err);
        res.send({ type: 'error', error: err });
    }
});
router.post('/downloadfeed', async function (req, res) {
    console.log('downloading feed!');
    console.log(req.body);
    downloadzip(res);
    return;
    let dbData = await checkLastUpdateDateTable();
    if (dbData.Item.crawlingstatus == true) {
        res.redirect('http://ec2-54-255-199-236.ap-southeast-1.compute.amazonaws.com:8080/');
    } else {
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

async function downloadzip(res) {
    var fs = require('fs')
    const s3Zip = require('s3-zip')
    var FileNameList = await getobjectList();
    res.set('Content-disposition', 'attachment; filename=' + 'DownloadData.zip');
    // res.set('Content-Type', 'application/octet-stream');
    res.set('content-type', 'application/zip');
    s3Zip
        .archive({ region: 'ap-southeast-1', bucket: 'downloaddata-stylebox' }, '/', FileNameList)
        .pipe(res)
}
async function getobjectList(){
    var params = {
        Bucket: "examplebucket",
        MaxKeys: 2
    };
    let data = await s3.listObjectsV2(params).promise();
    data = data.Contents;
    var FileNameList = [];
    for (var i = 0; i < data.length; i++) {
        FileNameList.push(data[i].Key);
    }
    return FileNameList;
}