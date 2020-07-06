var AWS = require("aws-sdk");
AWS.config.update({
  region: "ap-southeast-1",
});
var docClient = new AWS.DynamoDB.DocumentClient();

var SelectAcount = {
  selectaccount: async function (accountNum, LastLoginNum) {
    var ID, PW;
    var dbData = await getaccoutlistTable(accountNum, LastLoginNum);
    ID = dbData.Item.ID;
    PW = dbData.Item.PW;
    return [ID, PW];
  },
};
async function getaccoutlistTable(accountNum, LastLoginNum) {
  try {
    LastLoginNum += 1;
    if (LastLoginNum > accountNum) {
      LastLoginNum = 1;
    }
    var params = {
      TableName: "accountlist",
      Key: {
        LoginNum: LastLoginNum,
      },
    };
    let data = await docClient.get(params).promise();
    await updateLastUpdateDateTable(LastLoginNum);
    return data;
  } catch (err) {
    console.log(err);
  }
}
async function updateLastUpdateDateTable(LastLoginNum) {
  try {
    var params = {
      TableName: "LastUpdateDate",
      Key: {
        No: 1,
      },
      UpdateExpression: "set LastLoginNum = :llm",
      ExpressionAttributeValues: {
        ":llm": LastLoginNum,
      },
    };
    await docClient.update(params).promise();
    return;
  } catch (err) {
    console.log(err);
  }
}
module.exports = SelectAcount;
