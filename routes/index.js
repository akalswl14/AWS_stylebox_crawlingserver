var express = require("express");
var router = express.Router();

var Crawling = require("./crawling");
var MakeDownload = require("./MakeDownloadJson");
var AWS = require("aws-sdk");
AWS.config.update({
  region: "ap-southeast-1",
});
var docClient = new AWS.DynamoDB.DocumentClient();

router.get("/", function (req, res) {
  res.send("Crawling Page");
});

router.get("/firstcrawling", async function (req, res) {
  console.log("crawling brand!");
  var TodayDate = GetTodayDate();
  try {
    let dbData = await checkLastUpdateDateTable();
    if (dbData.Item.crawlingstatus == true) {
      res.redirect(
        "http://stylebox-manage-webserver-dev.ap-southeast-1.elasticbeanstalk.com/"
      );
      return;
    } else if (dbData.Item.lastupdatedate == TodayDate) {
      res.redirect(
        "http://stylebox-manage-webserver-dev.ap-southeast-1.elasticbeanstalk.com/"
      );
      return;
    } else {
      Crawling.runcrawling();
    }
  } catch (err) {
    console.log(err);
    res.send({ type: "error", error: err });
  }
});
router.post("/downloadfeed", async function (req, res) {
  console.log("downloading feed!");
  console.log(req.body);
  let dbData = await checkLastUpdateDateTable();
  if (dbData.Item.crawlingstatus == true) {
    res.redirect(
      "http://stylebox-manage-webserver-dev.ap-southeast-1.elasticbeanstalk.com/"
    );
  } else {
    MakeDownload.makejson(req, res);
  }
});
async function checkLastUpdateDateTable() {
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
  }
}
function GetTodayDate() {
  var date = new Date();
  var year = date.getFullYear();
  var month = new String(date.getMonth() + 1);
  var day = new String(date.getDate());

  if (month.length == 1) {
    month = "0" + month;
  }
  if (day.length == 1) {
    day = "0" + day;
  }
  var TodayDate = year + "-" + month + "-" + day;
  return TodayDate;
}
module.exports = router;
