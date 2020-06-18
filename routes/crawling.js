var UpdateDate = require('./UpdateDate');
var fs = require('fs');
var baseUrl = 'https://www.instagram.com/';
const puppeteer = require('puppeteer');
var SelectAccount = require('./SelectAccount');

const init = async (req, res) => {
    var AvoidMultiReq = UpdateCrawlingStatus(true);
    if(AvoidMultiReq == false){
        console.log('Crawling is already on. Cancel this request.');
        return ;
    }
    var BrandList = GetBrandList();
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    Len_BrandList = Object.keys(BrandList).length;
    for (var i = 0; i < Len_BrandList; i++) {
        console.log('for문')
        //  Reset Brand information to 0 or ""
        var eachBrand = Object.keys(BrandList)[i];
        BrandList[eachBrand]['TodayDownloadNum'] = 0
        BrandList[eachBrand]['Comment'] = ""
        // NewFeedNum, UpdateFeedNum, FollowerNum, Feed information, etc scraping
        console.log(eachBrand);
        var profileData = await Scroll(BrandList[eachBrand], page);
        console.log(profileData.hasOwnProperty(['graphql']));
        while(profileData.hasOwnProperty(['graphql'])&&profileData['graphql'].hasOwnProperty('user')&&profileData['graphql']['user']['username']!=BrandList[eachBrand]['instaID']){
            profileData = await Scroll(BrandList[eachBrand], page);
        }
        if (profileData.hasOwnProperty(['graphql']) && profileData['graphql'].hasOwnProperty('user')) {
            BrandList[eachBrand] = ParseData(BrandList[eachBrand], eachBrand, profileData);
        }else{
            if( BrandList[eachBrand]['reviewstatus'] == 'Y'){
                console.log("init_ELSE ; Change UpdateFeedNum")
                BrandList[eachBrand]['UpdateFeedNum'] = 0
            }
            BrandList[eachBrand]['reviewstatus'] = 'N';
            console.log("init_ELSE ; Change NewFeedNum")
            BrandList[eachBrand]['NewFeedNum'] = 0
        }
        UpdateBrandJson(BrandList);
    }
    await browser.close();
    UpdateCrawlingStatus(false);
    UpdateDate.update_date(req,res);
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
    if(json_data['crawlingstatus']==true && status==true){
        return false;
    }else{
        json_data['crawlingstatus'] = status;
        fs.writeFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json', JSON.stringify(json_data), 'utf-8');
        return true;
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
const ParseData = (brand, brandName, profileData) => {
    CrawlingData = GetCrawlingFeedJson()
    console.log('parsing data');
    dataFeedNum = brand['FeedNum']
    console.log(profileData['graphql']['user']['username'])
    var OriginalFollowerNum = profileData['graphql']['user']['edge_followed_by']['count'];
    brand['FollowerNum'] = OriginalFollowerNum;
    var OriginalPostNum = profileData['graphql']['user']['edge_owner_to_timeline_media']['count'];
    var UpdateFeedNum = OriginalPostNum - dataFeedNum;
    console.log("PARSEDATA ; Change NewFeedNum")
    brand['NewFeedNum'] = UpdateFeedNum;
    if (UpdateFeedNum > 12) {
        UpdateFeedNum = 12;
    }
    if (brand['ReviewStatus'] == 'N') {
        console.log("PARSEDATA_if_+= ; Change UpdateFeedNum")
        brand['UpdateFeedNum'] += UpdateFeedNum;
    } else {
        console.log("PARSEDATA_else_+= ; Change UpdateFeedNum")
        brand['UpdateFeedNum'] = UpdateFeedNum;
        brand['ReviewStatus'] = 'N'
    }
    brand['FeedNum'] = OriginalPostNum;
    for (var i = 0; i < UpdateFeedNum; i++) {
        var EachPostId = profileData['graphql']['user']['edge_owner_to_timeline_media']['edges'][i]['node']['shortcode'];
        var PostTimeStamp = profileData['graphql']['user']['edge_owner_to_timeline_media']['edges'][i]['node']['taken_at_timestamp'];
        var ContentsNum = 1;
        if (profileData['graphql']['user']['edge_owner_to_timeline_media']['edges'][i]['node'].hasOwnProperty('edge_sidecar_to_children')) {
            ContentsNum = profileData['graphql']['user']['edge_owner_to_timeline_media']['edges'][i]['node']['edge_sidecar_to_children']['edges'].length
        }
        var ContentsDict = {};
        for (var j = 1; j <= ContentsNum; j++) {
            var tmp_key = 'Contents_' + j;
            ContentsDict[tmp_key] = 0
        }
        var FeedData = {};
        FeedData['Date'] = DateConversion(new Date(PostTimeStamp * 1000));
        FeedData['ContentsNum'] = ContentsNum;
        FeedData['Contents'] = ContentsDict;
        FeedData['brand'] = brandName;
        FeedData['CrawlingDate'] = DateConversion(new Date());
        FeedData['DownloadNum'] = 0;
        FeedData['Check'] = false;
        CrawlingData[EachPostId] = FeedData;
    }
    UpdateCrawlingFeedJson(CrawlingData);
    return brand;
}
const Scroll = async (brand, page) => {
    console.log('Scroll')
    instaId = brand['instaID']
    console.log("INSTAGRAM ID : "+instaId);
    url = baseUrl + instaId + '?__a=1';
    await page.goto(url);
    await page.waitFor(5000);
    var element = await page.$('body > pre');
    if (element == null) {
        console.log('Login to instagram')
        var accoutinfo = SelectAccount.selectaccount();
        console.log("ID is "+accoutinfo[0]);
        console.log("PW is "+accoutinfo[1]);
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
    await page.screenshot({
        fullPage: true,
        path: `public/img/crawling_screenshot/example_afterlogin.jpeg`
    })
    var json_data = await page.evaluate(element => element.textContent, element);
    json_data = JSON.parse(json_data);
    return json_data
}
var crawling = {
    runcrawling: function (req, res) {
        init(req, res);
    }
};
module.exports = crawling;