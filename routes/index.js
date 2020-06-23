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
    const join = require('path').join
    const s3Zip = require('s3-zip')
    const XmlStream = require('xml-stream')

    const bucket = 'downloaddata-stylebox'
    const folder = '/'
    const params = {
        Bucket: bucket,
        Prefix: folder
    }

    const filesArray = []
    const files = s3.listObjects(params).createReadStream()
    const xml = new XmlStream(files)
    xml.collect('Key')
    xml.on('endElement: Key', function (item) {
        filesArray.push(item['$text'].substr(folder.length))
    })

    xml
        .on('end', function () {
            zip(filesArray,res)
        })

    function zip(files,res) {
        console.log(files)
        const output = fs.createWriteStream(join(__dirname, 'use-s3-zip.zip'))
        res.set('Content-disposition', 'attachment; filename=' + 'DownloadData.zip');
        // res.set('Content-Type', 'application/octet-stream');
        res.set('content-type', 'application/zip')
        s3Zip
            .archive({ bucket: bucket, preserveFolderStructure: true }, folder, files)
            .pipe(res)
    }
}