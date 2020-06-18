var fs = require('fs');
const puppeteer = require('puppeteer');
var XLSX = require('xlsx');
var request = require('request');
var AdmZip = require('adm-zip');
var stream = require('stream');
var baseUrl = 'https://www.instagram.com/';
var SelectAccount = require('./SelectAccount');
var RequestJsonData;

const init = async (ReqJsonData, res) => {
    var AvoidMultiReq = UpdateCrawlingStatus(true);
    if (AvoidMultiReq == false) {
        console.log('Crawling is already on. Cancel this request.');
        res.redirect('/');
        return;
    } else if (AvoidMultiReq[0] ==true && AvoidMultiReq[1]==false) {
        var path = 'public/DownloadData/';
        var DownloadJsonData = {}
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function (file, index) {
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
            console.log('remove folder')
        }
        fs.mkdirSync(path);
        console.log('make folder')
    } else {
        var DownloadJsonData = GetDownloadDataJson();
    }
    RequestJsonData = ReqJsonData;
    var BrandData = GetBrandList();
    var CrawlingData = GetCrawlingFeedJson();
    var FeedUrlList = Object.keys(RequestJsonData);
    var Len_UrlList = FeedUrlList.length;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    for (var i = 0; i < Len_UrlList; i++) {
        console.log('for문')
        var EachUrl = FeedUrlList[i];
        console.log(EachUrl);
        var JsonData = await Scroll(EachUrl, page);
        console.log(JsonData.hasOwnProperty(['graphql']));
        var BrandName = CrawlingData[EachUrl]['brand']
        if (JsonData.hasOwnProperty(['graphql']) && JsonData['graphql'].hasOwnProperty('shortcode_media') && JsonData['graphql']['shortcode_media']['owner']['username'] == BrandData[BrandName]['instaID']) {
            var FeedData = ParseData(EachUrl, BrandName, RequestJsonData[EachUrl], JsonData);
            for (var j = 0; j < RequestJsonData[EachUrl].length; j++) {
                tmp = 'Contents_' + String(j + 1);
                CrawlingData[EachUrl]['Contents'][tmp] += 1
            }
            CrawlingData[EachUrl]['DownloadNum'] += 1
            BrandData[BrandName]['TodayDownloadNum'] += 1
            BrandData[BrandName]['DownloadNum'] += 1
            FeedData['Brand'] = BrandName;
            DownloadJsonData[EachUrl] = FeedData;
        }
    }
    UpdateBrandJson(BrandData);
    UpdateCrawlingFeedJson(CrawlingData);
    UpdateDownloadDataJson(DownloadJsonData);
    await browser.close();
    var excelHandler = MakeExcelData()
    MakeExcel(excelHandler);
    await new Promise(resolve => setTimeout(resolve, 5000));
    var willSendthis = DownloadZip();
    // res.redirect('/');
    var readStream = new stream.PassThrough();
    readStream.end(willSendthis);
    res.set('Content-disposition', 'attachment; filename=' + 'DownloadData.zip');
    res.set('Content-Type', 'application/octet-stream');
    UpdateCrawlingStatus(false);
    res.send(willSendthis);
    // readStream.pipe(res);
    // res.download(willSendthis,'DownloadData.zip');
};
const GetDownloadDataJson = () => {
    console.log('GetDownloadDataJson')
    const DataBuffer = fs.readFileSync('public/json/DownloadData.json');
    var JsonData = JSON.parse(DataBuffer.toString());
    return JsonData;
};
const GetBrandList = () => {
    console.log('GetBrandList')
    const DataBuffer = fs.readFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/brand.json');
    var JsonData = JSON.parse(DataBuffer.toString());
    return JsonData;
};
const GetCrawlingFeedJson = () => {
    console.log('GetCrawlingJson')
    const DataBuffer = fs.readFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/CrawlingFeed.json');
    var JsonData = JSON.parse(DataBuffer.toString());
    return JsonData;
}
const UpdateDownloadDataJson = (JsonData) => {
    console.log('UpdateDownloadDataJson')
    fs.writeFileSync('public/json/DownloadData.json', JSON.stringify(JsonData), 'utf-8');
};
const UpdateBrandJson = (JsonData) => {
    console.log('UpdateBrandList')
    fs.writeFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/brand.json', JSON.stringify(JsonData), 'utf-8');
}
const UpdateCrawlingFeedJson = (JsonData) => {
    console.log('UpdateCrawlingJson')
    fs.writeFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/CrawlingFeed.json', JSON.stringify(JsonData), 'utf-8');
}
const UpdateCrawlingStatus = (status) => {
    console.log('Update CrawlingStatus');
    var json_data = JSON.parse(fs.readFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json').toString());
    if (json_data['crawlingstatus'] == true && status == true) {
        return false;
    } else {
        json_data['crawlingstatus'] = status;
        var TodatyDate = DateConversion(new Date());
        var jsonDate = json_data['lastdownloaddate'];
        json_data['lastdownloaddate'] = TodatyDate;
        console.log("JSON DATE is "+jsonDate);
        fs.writeFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json', JSON.stringify(json_data), 'utf-8');
        if (jsonDate == TodatyDate) {
            return [true, true];
        } else {
            return [true, false];
        }

    }
}
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
const ParseData = (FeedId, BrandName, ReqContData, JsonData) => {
    var FeedData = {}
    console.log('parsing data');
    console.log(JsonData['graphql']['shortcode_media']['owner']['username'])
    var PostTimeStamp = JsonData['graphql']['shortcode_media']['taken_at_timestamp'];
    FeedData['Date'] = DateConversion(new Date(PostTimeStamp * 1000));
    FeedData['TagList'] = ''
    FeedData['Text'] = JsonData['graphql']['shortcode_media']['edge_media_to_caption']['edges'][0]['node']['text']
    FeedData['LikeNum'] = JsonData['graphql']['shortcode_media']['edge_media_preview_like']['count']
    var is_video = JsonData['graphql']['shortcode_media']['is_video']
    var ContentsList = {}
    // igtv / One video
    if (is_video == true) {
        var ContUrl = JsonData['graphql']['shortcode_media']['video_url'];
        var filename = BrandName + '_' + FeedId + '_' + 'Contents_1';
        ContentsList[filename] = ContUrl;
        var DownloadPath = 'public/DownloadData/' + filename
        DownloadOnLocal(ContUrl, DownloadPath)
    } else {
        // Multiple Images / Multiple Videos / Multiple Images and Videos
        if (JsonData['graphql']['shortcode_media'].hasOwnProperty('edge_sidecar_to_children')) {
            Len_ContJson = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'].length;
            for (var j = 0; j < Len_ContJson; j++) {
                if (ReqContData.includes(String(j + 1))) {
                    var filename = BrandName + '_' + FeedId + '_' + 'Contents_' + String(j + 1);
                    if (JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['is_video']) {
                        // for Video
                        var ContUrl = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['video_url'];
                        ContentsList[filename] = ContUrl;
                    } else {
                        // for Image
                        var ContUrl = JsonData['graphql']['shortcode_media']['edge_sidecar_to_children']['edges'][j]['node']['display_url'];
                        ContentsList[filename] = ContUrl
                    }
                    var DownloadPath = 'public/DownloadData/' + filename;
                    DownloadOnLocal(ContUrl, DownloadPath)
                }
            }
        } else {
            //One Image
            var ContUrl = JsonData['graphql']['shortcode_media']['display_url'];
            var filename = BrandName + '_' + FeedId + '_' + 'Contents_1';
            ContentsList[filename] = ContUrl;
            var DownloadPath = 'public/DownloadData/' + filename;
            DownloadOnLocal(ContUrl, DownloadPath)
        }
    }
    FeedData['Contents'] = ContentsList;
    return FeedData;
}
const Scroll = async (EachUrl, page) => {
    console.log('Scroll')
    url = baseUrl + '/p/' + EachUrl + '?__a=1';
    await page.goto(url);
    await page.waitFor(5000);
    var element = await page.$('body > pre');
    if (element == null) {
        console.log('Login to instagram')
        var accoutinfo = SelectAccount.selectaccount();
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
            await page.click('button[type="submit"]');
            await page.waitFor(5000);
            await page.goto(url);
            element = await page.$('body > pre');
        } catch (error) {
            console.log('Cannot Login to Instagram');
            console.log(error);
            await page.screenshot({
                fullPage: true,
                path: `public/img/crawling_screenshot/example_whynull_1.jpeg`
            })
            await page.goto(url);
            await page.waitFor(5000);
            var element = await page.$('body > pre');
            await page.screenshot({
                fullPage: true,
                path: `public/img/crawling_screenshot/example_whynull_2.jpeg`
            })
            return {}
        }
    }
    var json_data = await page.evaluate(element => element.textContent, element);
    json_data = JSON.parse(json_data);
    return json_data
}
const MakeExcelData = () => {
    console.log('MakeExcelData');
    var ColumnNameList = ['PictureId', 'FeedId', 'Date', 'Brand', 'ContentsNumber', 'ContentsUrl', 'LikeNum', 'HashTagList', 'Text'];
    var DownloadJsonData = GetDownloadDataJson();
    var KeyList = Object.keys(RequestJsonData);
    var ExcelDataList = [ColumnNameList];
    for (var i = 0; i < KeyList.length; i++) {
        var EachKey = KeyList[i];
        var ContNumList = Object.keys(DownloadJsonData[EachKey]['Contents']);
        for (var j = 0; j < ContNumList.length; j++) {
            var EachContKey = ContNumList[j];
            tmpList = [];
            tmpList.push(EachContKey);
            tmpList.push(EachKey);
            tmpList.push(DownloadJsonData[EachKey]['Date']);
            tmpList.push(DownloadJsonData[EachKey]['Brand']);
            tmpList.push('Contents_' + (j + 1));
            tmpList.push(DownloadJsonData[EachKey]['Contents'][EachContKey]);
            tmpList.push(DownloadJsonData[EachKey]['LikeNum']);
            tmpList.push(DownloadJsonData[EachKey]['TagList']);
            tmpList.push(DownloadJsonData[EachKey]['Text']);
            ExcelDataList.push(tmpList);
        }
    }
    var files = fs.readdirSync('public/DownloadData');
    var cnt = 1;
    while (true) {
        if (files.includes('DownloadCrawling_' + cnt + '.xlsx')) {
            cnt++;
        } else {
            break;
        }
    }
    var excelHandler = {
        getExcelFileName: function () {
            return 'public/DownloadData/DownloadCrawling_' + cnt + '.xlsx';
        },
        getSheetName: function () {
            return 'DownloadData';
        },
        getExcelData: function () {
            return ExcelDataList;
        },
        getWorksheet: function () {
            return XLSX.utils.aoa_to_sheet(this.getExcelData());
        }
    }
    return excelHandler
}
const MakeExcel = (excelHandler) => {
    console.log('MakeExcel');
    var wb = XLSX.utils.book_new();
    var newWorksheet = excelHandler.getWorksheet();
    wb.SheetNames.push(excelHandler.getSheetName());
    wb.Sheets[excelHandler.getSheetName()] = newWorksheet;
    XLSX.writeFile(wb, excelHandler.getExcelFileName());
}
const DownloadOnLocal = (url, path) => {
    if (url.indexOf('.mp4') != -1) {
        // Download Video
        path += '.mp4'
    } else {
        // Download Image
        path += '.jpg'
    }
    request(url).pipe(fs.createWriteStream(path));
}
const DownloadZip = () => {
    var zip = new AdmZip();
    var files = fs.readdirSync('public/DownloadData');
    for (var i = 0; i < files.length; i++) {
        zip.addLocalFile('public/DownloadData/' + files[i]);
    }
    return zip.toBuffer();
}

var downloadcrawling = {
    runcrawling: function (ReqJsonData, res) {
        init(ReqJsonData, res);
    }
};
module.exports = downloadcrawling;