var AWS = require("aws-sdk");
AWS.config.update({
  region: "ap-southeast-1",
});
var docClient = new AWS.DynamoDB.DocumentClient();
var UpdateDate = require("./UpdateDate");
var baseUrl = "https://www.instagram.com/";
const puppeteer = require("puppeteer");
var SelectAccount = require("./SelectAccount");
var s3 = new AWS.S3();

const init = async (req, res) => {
  var dbData = await getLastUpdateDateTable();
  if (dbData == false) {
    return;
  }
  dbData = dbData.Item;
  if (dbData.crawlingstatus == true) {
    console.log("Crawling is already on. Cancel this request.");
    return;
  }
  var accountNum = dbData.accountNum;
  var LastLoginNum = dbData.LastLoginNum;
  dbData = await updateLastUpdateDateTable(true);
  if (dbData == false) {
    await updateLastUpdateDateTable(false);
    return;
  }
  var dbData = await scanallBrandTable();
  if (dbData == false) {
    await updateLastUpdateDateTable(false);
    return;
  }
  var BrandList = dbData.Items;
  var brandLength = Object.keys(BrandList).length;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  for (var i = 0; i < brandLength; i++) {
    console.log("for문");
    var rtnData;
    // NewFeedNum, UpdateFeedNum, FollowerNum, Feed information, etc scraping
    console.log(BrandList[i].brandName);
    var profileData = await Scroll(
      BrandList[i].instaID,
      accountNum,
      LastLoginNum,
      page
    );
    if (profileData == false) {
      await updateLastUpdateDateTable(false);
      await browser.close();
      return;
    }
    console.log(profileData.hasOwnProperty(["graphql"]));
    if (Object.keys(profileData).length == 0) {
      continue;
    }
    while (
      profileData.hasOwnProperty(["graphql"]) &&
      profileData["graphql"].hasOwnProperty("user") &&
      profileData["graphql"]["user"]["username"] != BrandList[i].instaID
    ) {
      profileData = await Scroll(
        BrandList[i].instaID,
        accountNum,
        LastLoginNum,
        page
      );
      if (profileData == false) {
        await updateLastUpdateDateTable(false);
        await browser.close();
        return;
      }
    }
    dbData = await getBrandInfoTable(BrandList[i].brandID);
    if (dbData == false) {
      await updateLastUpdateDateTable(false);
      await browser.close();
      return;
    }
    var brandInfoData = dbData.Item;
    if (
      profileData.hasOwnProperty(["graphql"]) &&
      profileData["graphql"].hasOwnProperty("user")
    ) {
      rtnData = await ParseData(brandInfoData, profileData);
      if (rtnData == false) {
        await updateLastUpdateDateTable(false);
        await browser.close();
        return;
      }
    } else {
      if (brandInfoData.ReviewStatus == "Y") {
        console.log("init_ELSE ; Change UpdateFeedNum");
        rtnData.UpdateFeedNum = 0;
      }
      rtnData.ReviewStatus = "N";
      console.log("init_ELSE ; Change NewFeedNum");
      rtnData.NewFeedNum = 0;
    }
    rtnData.TodayDownloadNum = 0;
    rtnData.Comment = "";
    rtnData = Object.assign(brandInfoData, rtnData);
    dbData = await updateBrandInfoTable(rtnData);
    if (dbData == false) {
      await updateLastUpdateDateTable(false);
      await browser.close();
      return;
    }
  }
  await browser.close();
  await updateLastUpdateDateTable(false);
  await UpdateDate.update_date();
  console.log("Succesfully FirstCrawling!!");
};
async function getLastUpdateDateTable() {
  try {
    var params = {
      TableName: "LastUpdateDate",
      Key: {
        No: 1,
      },
    };
    let data = await docClient.get(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function getBrandInfoTable(brandID) {
  try {
    var params = {
      TableName: "BrandInfo",
      Key: {
        brandID: brandID,
      },
    };
    let data = await docClient.get(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function updateLastUpdateDateTable(inputBool) {
  try {
    var params = {
      TableName: "LastUpdateDate",
      Key: {
        No: 1,
      },
      UpdateExpression: "set crawlingstatus = :cs",
      ExpressionAttributeValues: {
        ":cs": inputBool,
      },
    };
    let data = await docClient.update(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function updateBrandInfoTable(inputData) {
  try {
    console.log("updating BrandInfo Table with " + inputData.brandID);
    var params = {
      TableName: "BrandInfo",
      Key: {
        brandID: inputData.brandID,
      },
      ReturnValues: "ALL_NEW",
      ExpressionAttributeNames: {
        "#Fol": "FollowerNum",
        "#Feed": "FeedNum",
        "#UFeed": "UpdateFeedNum",
        "#NFeed": "NewFeedNum",
        "#TDN": "TodayDownloadNum",
        "#DN": "DownloadNum",
        "#RS": "ReviewStatus",
        "#CM": "Comment",
      },
      UpdateExpression:
        "set #Fol = :fol,#Feed = :feed,#UFeed = :ufeed,#NFeed = :nfeed,#TDN = :tdn,#DN = :dn,#RS = :rs,#CM = :c",
      ExpressionAttributeValues: {
        ":fol": inputData.FollowerNum,
        ":feed": inputData.FeedNum,
        ":ufeed": inputData.UpdateFeedNum,
        ":nfeed": inputData.NewFeedNum,
        ":tdn": inputData.TodayDownloadNum,
        ":dn": inputData.DownloadNum,
        ":rs": inputData.ReviewStatus,
        ":c": inputData.Comment,
      },
    };
    let data = await docClient.update(params).promise();
    console.log(data);
    return data;
  } catch (err) {
    console.log("while updating BrandInfoTable");
    console.log(err);
    return false;
  }
}
async function batchwriteCrawlingFeedTable(inputData) {
  try {
    var params = {
      RequestItems: {
        CrawlingFeed: inputData,
      },
    };
    let data = await docClient.batchWrite(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function batchwriteFeedIDListTable(inputData) {
  try {
    var params = {
      RequestItems: {
        FeedIDList: inputData,
      },
    };
    let data = await docClient.batchWrite(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function scanallBrandTable() {
  try {
    var params = {
      TableName: "Brand",
    };
    let data = await docClient.scan(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    return false;
  }
}
async function saveErrorimageStylebox(buffer, filename) {
  try {
    const bucketParams = {
      Bucket: "errorimage-stylebox",
      Key: filename,
      Body: buffer,
    };
    let data = await s3.putObject(bucketParams).promise();
    console.log("succeed!");
    return data;
  } catch (err) {
    console.log(err);
  }
}
const DateConversion = (date) => {
  var rtnDate = "";
  var year = date.getFullYear();
  var month = new String(date.getMonth() + 1);
  var day = new String(date.getDate());

  if (month.length == 1) {
    month = "0" + month;
  }
  if (day.length == 1) {
    day = "0" + day;
  }
  var rtnDate = year + "-" + month + "-" + day;
  return rtnDate;
};
const ParseData = async (brandInfoData, profileData) => {
  var brandID = brandInfoData.brandID;
  var rtnData = {};
  console.log("parsing data");
  dataFeedNum = brandInfoData.FeedNum;
  console.log(profileData["graphql"]["user"]["username"]);
  var OriginalFollowerNum =
    profileData["graphql"]["user"]["edge_followed_by"]["count"];
  brandInfoData.FollowerNum = OriginalFollowerNum;
  var OriginalPostNum =
    profileData["graphql"]["user"]["edge_owner_to_timeline_media"]["count"];
  var UpdateFeedNum = OriginalPostNum - dataFeedNum;
  console.log("PARSEDATA ; Change NewFeedNum");
  rtnData.NewFeedNum = UpdateFeedNum;
  if (UpdateFeedNum > 12) {
    UpdateFeedNum = 12;
  }
  if (brandInfoData.ReviewStatus == "N") {
    console.log("PARSEDATA_if_+= ; Change UpdateFeedNum");
    rtnData.UpdateFeedNum = brandInfoData.UpdateFeedNum + UpdateFeedNum;
  } else {
    console.log("PARSEDATA_else_+= ; Change UpdateFeedNum");
    rtnData.UpdateFeedNum = UpdateFeedNum;
    rtnData.ReviewStatus = "N";
  }
  rtnData.FeedNum = OriginalPostNum;
  var inputData = [];
  var inputData2 = [];
  for (var i = 0; i < UpdateFeedNum; i++) {
    var EachPostId =
      profileData["graphql"]["user"]["edge_owner_to_timeline_media"]["edges"][
        i
      ]["node"]["shortcode"];
    var PostTimeStamp =
      profileData["graphql"]["user"]["edge_owner_to_timeline_media"]["edges"][
        i
      ]["node"]["taken_at_timestamp"];
    var ContentsNum = 1;
    if (
      profileData["graphql"]["user"]["edge_owner_to_timeline_media"]["edges"][
        i
      ]["node"].hasOwnProperty("edge_sidecar_to_children")
    ) {
      ContentsNum =
        profileData["graphql"]["user"]["edge_owner_to_timeline_media"]["edges"][
          i
        ]["node"]["edge_sidecar_to_children"]["edges"].length;
    }
    var ContentsDict = {};
    for (var j = 1; j <= ContentsNum; j++) {
      var tmp_key = "Contents_" + j;
      ContentsDict[tmp_key] = 0;
    }
    var FeedData = {};
    FeedData["FeedID"] = EachPostId;
    FeedData["Date"] = DateConversion(new Date(PostTimeStamp * 1000));
    FeedData["ContentsNum"] = ContentsNum;
    FeedData["Contents"] = ContentsDict;
    FeedData["brandID"] = brandID;
    FeedData["CrawlingDate"] = DateConversion(new Date());
    FeedData["DownloadNum"] = 0;
    FeedData["Check"] = false;
    var tmp = {
      PutRequest: {
        Item: FeedData,
      },
    };
    inputData.push(tmp);
    tmp = {
      PutRequest: {
        Item: {
          brandID: brandID,
          FeedID: EachPostId,
        },
      },
    };
    inputData2.push(tmp);
  }
  if (inputData.length > 0) {
    var tmprtn = await batchwriteCrawlingFeedTable(inputData);
    if (tmprtn == false) {
      return false;
    }
    var tmprtn = await batchwriteFeedIDListTable(inputData2);
    if (tmprtn == false) {
      return false;
    }
  }
  return rtnData;
};
const Scroll = async (instaId, accountNum, LastLoginNum, page) => {
  console.log("Scroll");
  console.log("INSTAGRAM ID : " + instaId);

  var url = baseUrl + instaId + "/?__a=1";
  await page.goto(url);
  await page.waitFor(5000);
  var element = await page.$("body > pre");
  if (instaId == "lepdress") {
    let buffer = await page.screenshot({ fullPage: true });
    let filename = "FirstPuppeteerSelect.jpeg";
    await saveErrorimageStylebox(buffer, filename);
  }
  if (element == null) {
    try {
      await page.goto("https://www.instagram.com/?__a=1");
      await page.waitFor(5000);
      element = await page.$("body > pre");
      var json_data = await page.evaluate(
        (element) => element.textContent,
        element
      );
      json_data = JSON.parse(json_data);
    } catch (err) {
      console.log("While evalute json data : " + err);
      return false;
    }
    //로그인한 상태.
    if (Object.keys(json_data).length == 0) {
      return {};
    } else {
      console.log("Login to instagram");
      var accoutinfo = await SelectAccount.selectaccount(
        accountNum,
        LastLoginNum
      );
      console.log("ID is " + accoutinfo[0]);
      console.log("PW is " + accoutinfo[1]);
      const insta_id = accoutinfo[0];
      const insta_pw = accoutinfo[1];
      try {
        //페이지로 가라
        await page.goto("https://www.instagram.com/accounts/login/");

        //아이디랑 비밀번호 란에 값을 넣어라
        await page.waitForSelector('input[name="username"]');
        await page.type('input[name="username"]', insta_id);
        await page.type('input[name="password"]', insta_pw);
        await page.waitFor(1000);
        await page.click('button[type="submit"]');
        await page.waitFor(5000);
        await page.goto(url);
        element = await page.$("body > pre");
      } catch (error) {
        console.log("Cannot Login to Instagram");
        console.log(error);
        let buffer = await page.screenshot({ fullPage: true });
        let filename = "example_whynull_1.jpeg";
        await saveErrorimageStylebox(buffer, filename);
        return false;
      }
    }
  }
  try {
    var json_data = await page.evaluate(
      (element) => element.textContent,
      element
    );
    json_data = JSON.parse(json_data);
    return json_data;
  } catch (err) {
    console.log("While evalute json data : " + err);
    return false;
  }
};
var crawling = {
  runcrawling: function () {
    init();
  },
};
module.exports = crawling;
