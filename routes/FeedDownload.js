var AWS = require('aws-sdk');
var fs = require('fs');
AWS.config.update({
    region: 'ap-southeast-1'
})
var docClient = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();

const puppeteer = require('puppeteer');
var XLSX = require('xlsx');
var request = require('request');
var AdmZip = require('adm-zip');
var baseUrl = 'https://www.instagram.com/';
var SelectAccount = require('./SelectAccount');
var UpdateDate = require('./UpdateDate');
var RequestJsonData;

const init = async (ReqJsonData, res) => {
    var dbData = await getLastUpdateDateTable();
    dbData = dbData.Item;
    if (dbData.crawlingstatus == true) {
        console.log('Crawling is already on. Cancel this request.');
        return;
    }
    var accountNum = dbData.accountNum;
    var LastLoginNum = dbData.LastLoginNum;
    var DownloadNum = dbData.DownloadNum;
    await updateLastUpdateDateTable(true);
    var TodatyDate = DateConversion(new Date());
    if (dbData.lastdownloaddate != TodatyDate) {
        await clearBucket('downloaddata-stylebox');
        await clearDownloadDataTable();
        if(DownloadNum != 0){
            await update_downloadnum_LastUpdateDateTable(0);
            DownloadNum = 0;
        }
    }
    var PictureIdList = [];
    RequestJsonData = ReqJsonData;
    var FeedUrlList = Object.keys(RequestJsonData);
    var Len_UrlList = FeedUrlList.length;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    for (var i = 0; i < Len_UrlList; i++) {
        console.log('for문')
        var EachUrl = FeedUrlList[i];
        console.log(EachUrl);
        var JsonData = await Scroll(EachUrl, accountNum, LastLoginNum, page);
        console.log(JsonData.hasOwnProperty(['graphql']));
        dbData = await getCrawlingFeedTable(EachUrl);
        var CrawlingData = dbData.Item;
        var brandID = CrawlingData.brandID;
        dbData = await getBrandInfoTable(brandID);
        var BrandInfoData = dbData.Item;
        var instaID = BrandInfoData.instaID;
        if (JsonData.hasOwnProperty(['graphql']) && JsonData['graphql'].hasOwnProperty('shortcode_media') && JsonData['graphql']['shortcode_media']['owner']['username'] == instaID) {
            var tmpPicList = await ParseData(EachUrl, BrandInfoData, JsonData);
            PictureIdList = PictureIdList.concat(tmpPicList);
            for (var j = 0; j < RequestJsonData[EachUrl].length; j++) {
                tmp = 'Contents_' + String(j + 1);
                CrawlingData.Contents[tmp] += 1;
            }
            CrawlingData.DownloadNum += 1;
            BrandInfoData.TodayDownloadNum += 1;
            BrandInfoData.DownloadNum += 1;
        }
        await updateBrandInfoTable(BrandInfoData);
        await updateCrawlingFeedTable(CrawlingData);
    }
    await browser.close();
    var ExcelDataList = await MakeExcelData(PictureIdList);
    MakeExcel(ExcelDataList);
    await new Promise(resolve => setTimeout(resolve, 5000));
    await uploadExcel(DownloadNum);
    var willSendthis = await DownloadZip();
    await updateLastUpdateDateTable(false);
    await update_downloadnum_LastUpdateDateTable(DownloadNum);
    await UpdateDate.update_downloaddate(req, res);
    res.set('Content-Type','application/octet-stream');
    res.set('Content-Disposition','attachment; filename=DownloadData.zip');
    res.set('Content-Length',willSendthis.length);
    res.send(willSendthis);
};
const DateConversion = (date) => {
    var rtnDate = '';
    var year = date.getFullYear();
    var month = new String(date.getMonth() + 1);
    var day = new String(date.getDate());

    if (month.length == 1) {
        month = "0" + month;
    }
    if (day.length == 1) {
        day = "0" + day;
    }
    var rtnDate = year + '-' + month + '-' + day;
    return rtnDate;
}
const ParseData = async (FeedId, BrandInfoData, JsonData) => {
    var brandName = BrandInfoData.brandName;
    var ReqContData = RequestJsonData[FeedId];
    var FeedData = {}
    var PictureIdList = [];
    console.log('parsing data');
    console.log(JsonData['graphql']['shortcode_media']['owner']['username'])
    var PostTimeStamp = JsonData['graphql']['shortcode_media']['taken_at_timestamp'];
    FeedData['Date'] = DateConversion(new Date(PostTimeStamp * 1000));
    FeedData['TagList'] = '';
    FeedData['Text'] = JsonData['graphql']['shortcode_media']['edge_media_to_caption']['edges'][0]['node']['text'];
    FeedData['LikeNum'] = JsonData['graphql']['shortcode_media']['edge_media_preview_like']['count'];
    FeedData['brandName'] = brandName;
    FeedData['FeedID'] = FeedId;
    var is_video = JsonData['graphql']['shortcode_media']['is_video'];
    // igtv / One video
    if (is_video == true) {
        var ContUrl = JsonData['graphql']['shortcode_media']['video_url'];
        var filename = brandName + '_' + FeedId + '_' + 'Contents_1';
        await DownloadContent(ContUrl, filename);
        FeedData['PictureID'] = filename;
        FeedData['ContentsNum'] = 'Contents_1';
        FeedData['ContentsUrl'] = ContUrl;
        await updateDownloadDataTable(FeedData);
        PictureIdList.push(filename);
    } else {
        // Multiple Images / Multiple Videos / Multiple Images and Videos
        if (JsonData['graphql']['shortcode_media'].hasOwnProperty('edge_sidecar_to_children')) {
            Len_ContJson = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'].length;
            for (var j = 0; j < Len_ContJson; j++) {
                if (ReqContData.includes(String(j + 1))) {
                    var filename = brandName + '_' + FeedId + '_' + 'Contents_' + String(j + 1);
                    if (JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['is_video']) {
                        // for Video
                        var ContUrl = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['video_url'];
                    } else {
                        // for Image
                        var ContUrl = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['display_url'];
                    }
                    await DownloadContent(ContUrl, filename);
                    FeedData['PictureID'] = filename;
                    FeedData['ContentsNum'] = 'Contents_' + String(j + 1);
                    FeedData['ContentsUrl'] = ContUrl;
                    await updateDownloadDataTable(FeedData);
                    PictureIdList.push(filename);
                }
            }
        } else {
            //One Image
            var ContUrl = JsonData['graphql']['shortcode_media']['display_url'];
            var filename = brandName + '_' + FeedId + '_' + 'Contents_1';
            await DownloadContent(ContUrl, filename);
            FeedData['PictureID'] = filename;
            FeedData['ContentsNum'] = 'Contents_1';
            FeedData['ContentsUrl'] = ContUrl;
            await updateDownloadDataTable(FeedData);
            PictureIdList.push(filename);
        }
    }
    return PictureIdList;
}
const Scroll = async (EachUrl, accountNum, LastLoginNum, page) => {
    console.log('Scroll')
    url = baseUrl + '/p/' + EachUrl + '?__a=1';
    await page.goto(url);
    await page.waitFor(5000);
    var element = await page.$('body > pre');
    await page.waitFor(5000);
    let buffer = await page.screenshot({ fullPage: true });
    let filename = 'confirm_element.jpeg'
    await saveErrorimageStylebox(buffer, filename);
    if (element == null) {
        console.log('Login to instagram')
        var accoutinfo = await SelectAccount.selectaccount(accountNum, LastLoginNum);
        console.log("ID is " + accoutinfo[0]);
        console.log("PW is " + accoutinfo[1]);
        const insta_id = accoutinfo[0];
        const insta_pw = accoutinfo[1];
        try {
            //페이지로 가라
            await page.goto('https://www.instagram.com/accounts/login/');

            //아이디랑 비밀번호 란에 값을 넣어라
            await page.waitForSelector('input[name="username"]');
            await page.type('input[name="username"]', insta_id);
            await page.type('input[name="password"]', insta_pw);
            await page.waitFor(1000);
            await page.click('button[type="submit"]');
            await page.waitFor(5000);
            await page.goto(url);
            element = await page.$('body > pre');
            await page.waitFor(5000);
            buffer = await page.screenshot({ fullPage: true });
            filename = 'Afterlogin.jpeg'
            await saveErrorimageStylebox(buffer, filename);
        } catch (error) {
            console.log('Cannot Login to Instagram');
            console.log(error);
            let buffer = await page.screenshot({ fullPage: true });
            let filename = 'example_whynull_1.jpeg'
            await saveErrorimageStylebox(buffer, filename);
            await page.goto(url);
            await page.waitFor(5000);
            var element = await page.$('body > pre');
            await page.waitFor(5000);
            buffer = await page.screenshot({ fullPage: true });
            filename = 'example_whynull_2.jpeg'
            await saveErrorimageStylebox(buffer, filename);
            return {}
        }
    }
    try{
        var json_data = await page.evaluate(element => element.textContent, element);
        json_data = JSON.parse(json_data);
        return json_data
    }catch(err){
        console.log('while parse data from puppeteer crawling working');
        buffer = await page.screenshot({ fullPage: true });
        filename = 'whynull_afterlogin.jpeg'
        await saveErrorimageStylebox(buffer, filename);
    }
}
const MakeExcelData = async (PictureIdList) => {
    console.log('MakeExcelData');
    console.log(PictureIdList);
    var ColumnNameList = ['PictureID', 'FeedID', 'Date', 'brandName', 'ContentsNumber', 'ContentsUrl', 'LikeNum', 'HashTagList', 'Text'];

    var ExcelDataList = [ColumnNameList];
    for (var i = 0; i < PictureIdList.length; i++) {
        tmpList = [];
        var DownloadData = await getDownloadDataTable(PictureIdList[i]);
        DownloadData = DownloadData.Item;
        tmpList.push(DownloadData.PictureID);
        tmpList.push(DownloadData.FeedID);
        tmpList.push(DownloadData.Date);
        tmpList.push(DownloadData.brandName);
        tmpList.push(DownloadData.ContentsNum);
        tmpList.push(DownloadData.ContentsUrl);
        tmpList.push(DownloadData.LikeNum);
        tmpList.push(DownloadData.TagList);
        tmpList.push(DownloadData.Text);
        ExcelDataList.push(tmpList);
    }
    console.log("Make ExcelDataList Successfully!");
    return ExcelDataList
}
const MakeExcel = (ExcelDataList) => {
    console.log('MakeExcel');
    var wb = XLSX.utils.book_new();
    var newWorksheet = XLSX.utils.aoa_to_sheet(ExcelDataList);
    wb.SheetNames.push('DownloadData')
    wb.Sheets['DownloadData'] = newWorksheet;
    XLSX.writeFile(wb, 'public/DownloadData/DownloadCrawling.xlsx');
}
const DownloadZip = async () => {
    var FileNameList = await getobjectList();
    var zip = new AdmZip();
    for (var i = 0; i < FileNameList.length; i++) {
        console.log(i);
        var keyname = FileNameList[i];
        let filebuffer = await getfilebuffer(keyname);
        zip.addFile(keyname, filebuffer);
    }
    return zip.toBuffer();
}
async function getobjectList() {
    try {
        var params = {
            Bucket: "downloaddata-stylebox",
        };
        let data = await s3.listObjectsV2(params).promise();
        data = data.Contents;
        var FileNameList = [];
        for (var i = 0; i < data.length; i++) {
            FileNameList.push(data[i].Key);
        }
        return FileNameList;
    } catch (err) {
        console.log('while get objectlist from downloaddata-stylebox Bucket - S3');
        console.log(err);
    }
}
async function getfilebuffer(keyname) {
    try {
        var params = {
            Bucket: "downloaddata-stylebox",
            Key: keyname
        };
        let data = await s3.getObject(params).promise();
        return data.Body
    } catch (err) {
        console.log('whild get Body(filebuffer) from downloaddata-stylebox - S3');
        console.log(err);
    }
}
async function saveErrorimageStylebox(buffer, filename) {
    try {
        const bucketParams = {
            Bucket: 'errorimage-stylebox',
            Key: filename,
            Body: buffer
        };
        let data = await s3.putObject(bucketParams).promise();
        console.log("succeed!")
        return data;
    } catch (err) {
        console.log('while saving ErrorImage from errorimage-stylebox - S3');
        console.log(err);
    }
}
async function clearBucket(bucket) {
    try {
        console.log("Clearing Bucket!");
        let data = await s3.listObjects({ Bucket: bucket }).promise();
        var items = data.Contents;
        for (var i = 0; i < items.length; i += 1) {
            var deleteParams = { Bucket: bucket, Key: items[i].Key };
            data = await s3.deleteObject(deleteParams).promise();
            console.log(data);
        }
    } catch (err) {
        console.log('whild clear Bucket - S3');
        console.log(err);
    }
}
async function DownloadContent(uri, path) {
    try {
        var options = {
            uri: uri,
            encoding: null
        };
        if (uri.indexOf('.mp4') != -1) {
            // Download Video
            path += '.mp4'
        } else {
            // Download Image
            path += '.jpg'
        }
        request(options, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                console.log("failed to get image");
                console.log(error);
            } else {
                let data = s3.putObject({
                    Body: body,
                    Key: path,
                    Bucket: 'downloaddata-stylebox'
                }).promise();
                console.log("Successfully Download content!" + data);
                return data;
            }
        });
    } catch (err) {
        console.log('while download content');
        console.log(err);
    }
}
async function uploadExcel(DownloadNum) {
    try {
        DownloadNum += 1
        var filename = 'DownloadCrawling_' + DownloadNum + '.xlsx';
        const bucketParams = {
            Bucket: 'downloaddata-stylebox',
            Key: filename,
            Body: fs.createReadStream('public/DownloadData/DownloadCrawling.xlsx')
        };
        let data = await s3.putObject(bucketParams).promise();
        console.log("succeed!")
        return data;
    } catch (err) {
        console.log('while uploading excel to downloaddata-stylebox Bucket - S3');
        console.log(err);
    }
}
async function clearDownloadDataTable() {
    try {
        console.log("Clearing DownloadDataTable!");
        var dbData = await scanallDownloadDataTable();
        dbData = dbData.Items;
        var inputData = [];
        for (i = 0; i < Object.keys(dbData).length; i++) {
            var tmp = {
                DeleteReqeust: {
                    PictureID: dbData[i].PictureID
                }
            }
            inputData.push(tmp);
        }
        var params = {
            RequestItems: {
                'DownloadData': inputData
            }
        };
        let data = await docClient.batchWrite(params).promise();
        return data;
    } catch (err) {
        console.log("while clear DownloadData Table");
        console.log(err);
    }
}
async function scanallDownloadDataTable() {
    try {
        var params = {
            TableName: 'DownloadData',
        };
        let data = await docClient.scan(params).promise();
        return data;
    } catch (err) {
        console.log('while scanning DownloadData Table - DYNAMODB');
        console.log(err);
    }
}
async function updateLastUpdateDateTable(inputBool) {
    try {
        var params = {
            TableName: 'LastUpdateDate',
            Key: {
                "No": 1
            },
            UpdateExpression: 'set crawlingstatus = :cs',
            ExpressionAttributeValues: {
                ':cs': inputBool
            }
        };
        let data = await docClient.update(params).promise();
        return data;
    } catch (err) {
        console.log('While updating crawlingstatus on LastUpdateDate Table - DYNAMODB');
        console.log(err);
    }
}
async function update_downloadnum_LastUpdateDateTable(inputData) {
    try {
        var params = {
            TableName: 'LastUpdateDate',
            Key: {
                "No": 1
            },
            UpdateExpression: 'set DownloadNum = :DN',
            ExpressionAttributeValues: {
                ':DN': inputData
            }
        };
        let data = await docClient.update(params).promise();
        return data;
    } catch (err) {
        console.log('while updating downloadnum on LastUpdateDate Table - DYNAMODB');
        console.log(err);
    }
}
async function getBrandInfoTable(brandID) {
    try {
        var params = {
            TableName: 'BrandInfo',
            Key: {
                'brandID': brandID
            },
        };
        let data = await docClient.get(params).promise();
        return data;
    } catch (err) {
        console.log('while getting data on BrandInfo Table - DYNAMODB');
        console.log(err);
    }
}
async function getLastUpdateDateTable() {
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
        console.log('while getting data on LastUpdateDate Table - DYNAMODB');
        console.log(err);
    }
}
async function getCrawlingFeedTable(FeedID) {
    try {
        var params = {
            TableName: 'CrawlingFeed',
            Key: {
                'FeedID': FeedID
            },
        };
        let data = await docClient.get(params).promise();
        return data;
    } catch (err) {
        console.log('while getting data from CrawlingFeed Table - DYNAMODB');
        console.log(err);
    }
}
async function getDownloadDataTable(PictureID) {
    try {
        var params = {
            TableName: 'DownloadData',
            Key: {
                'PictureID': PictureID
            },
        };
        let data = await docClient.get(params).promise();
        return data;
    } catch (err) {
        console.log('while getting data on DownloadData Table - DYNAMODB');
        console.log(err);
    }
}
async function updateDownloadDataTable(FeedData) {
    try {
        var params = {
            TableName: 'DownloadData',
            Key: {
                "PictureID": FeedData.PictureID
            },
            ExpressionAttributeNames: {
                "#fID": "FeedID",
                "#DT": "Date",
                "#BN": "brandName",
                "#CN": "ContentsNum",
                "#CU": "ContentsUrl",
                "#LN": "LikeNum",
                "#TL": "TagList",
                "#TX": "Text"
            },
            UpdateExpression: 'set #fID = :fid,#DT = :dt,#BN = :bn,#CN = :cn,#CU = :cu,#LN = :ln,#TL = :tl,#TX = :tx',
            ExpressionAttributeValues: {
                ':fid': FeedData.FeedID,
                ':dt': FeedData.Date,
                ':bn': FeedData.brandName,
                ':cn': FeedData.ContentsNum,
                ':cu': FeedData.ContentsUrl,
                ':ln': FeedData.LikeNum,
                ':tl': FeedData.TagList,
                ':tx': FeedData.Text
            }
        };
        let data = await docClient.update(params).promise();
        return data;
    } catch (err) {
        console.log('while updating data on DownloadData Table - DYNAMODB');
        console.log(err);
    }
}
async function updateBrandInfoTable(BrandInfoData) {
    try {
        var params = {
            TableName: 'BrandInfo',
            Key: {
                "brandID": BrandInfoData.brandID
            },
            ExpressionAttributeNames: {
                "#TDN": "TodayDownloadNum",
                "#DN": "DownloadNum"
            },
            UpdateExpression: 'set #TDN = :tdn,#DN = :dn',
            ExpressionAttributeValues: {
                ':tdn': BrandInfoData.TodayDownloadNum,
                ':dn': BrandInfoData.DownloadNum
            }
        };
        let data = await docClient.update(params).promise();
        return data;
    } catch (err) {
        console.log('while updating data on BrandInfo Table - DYNAMODB');
        console.log(err);
    }
}
async function updateCrawlingFeedTable(CrawlingData) {
    try {
        var params = {
            TableName: 'CrawlingFeed',
            Key: {
                "FeedID": CrawlingData.FeedID
            },
            ExpressionAttributeNames: {
                "#C": "Contents",
                "#DN": "DownloadNum"
            },
            UpdateExpression: 'set #C = :c,#DN = :dn',
            ExpressionAttributeValues: {
                ':c': CrawlingData.Contents,
                ':dn': CrawlingData.DownloadNum
            }
        };
        let data = await docClient.update(params).promise();
        return data;
    } catch (err) {
        console.log('while updating data on CrawlingFeed Table - DYNAMODB');
        console.log(err);
    }
}
var downloadcrawling = {
    runcrawling: function (ReqJsonData, res) {
        init(ReqJsonData, res);
    }
};
module.exports = downloadcrawling;