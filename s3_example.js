var AWS = require('aws-sdk');
AWS.config.update({
    region: 'ap-southeast-1'
})
var s3 = new AWS.S3();

var AdmZip = require('adm-zip');

async function downloadzip() {
    var FileNameList = await getobjectList();
    var zip = new AdmZip();
    for (var i = 0; i < FileNameList; i++) {
        var keyname = FileName[i];
        var filebuffer = await getfilebuffer(keyname);
        zip.addFile(keyname, filebuffer);
    }
    return zip.toBuffer();
}
async function getobjectList() {
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
async function getfilebuffer(keyname) {
    var params = {
        Bucket: "downloaddata-stylebox",
        Key: keyname
    };
    let data = await s3.getObject(params).promise;
    return data.Body;
}