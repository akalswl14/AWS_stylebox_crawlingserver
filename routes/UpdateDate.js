var AWS = require("aws-sdk");
AWS.config.update({
  region: "ap-southeast-1",
});
var docClient = new AWS.DynamoDB.DocumentClient();

var UpdateDate = {
  update_date: async function () {
    try {
      var params = {
        TableName: "LastUpdateDate",
        Key: {
          No: 1,
        },
        UpdateExpression: "set lastupdatedate = :lud",
        ExpressionAttributeValues: {
          ":lud": GetTodayDate(),
        },
      };
      let data = await docClient.update(params).promise();
      console.log("Updating lastupdatedate!");
      return data;
    } catch (err) {
      console.log(err);
    }
  },
  update_downloaddate: async function () {
    try {
      var params = {
        TableName: "LastUpdateDate",
        Key: {
          No: 1,
        },
        UpdateExpression: "set lastdownloaddate = :ldd",
        ExpressionAttributeValues: {
          ":ldd": GetTodayDate(),
        },
      };
      let data = await docClient.update(params).promise();
      return data;
    } catch (err) {
      console.log(err);
    }
  },
};
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
module.exports = UpdateDate;
