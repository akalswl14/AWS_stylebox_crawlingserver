var AWS = require('aws-sdk');
AWS.config.update({
    region: 'ap-southeast-1'
})
var tableName = 'accountlist';
var docClient = new AWS.DynamoDB.DocumentClient();
var ParseObj = {"1":{"ID":"take5inno@gmail.com","PW":"t5innovation"},"2":{"ID":"howru16.kwak@abcstudio.co","PW":"taketake5inno"},"3":{"ID":"howru16.kwak@alliedenc.com","PW":"alliedabc"},"4":{"ID":"abc@abcstudio.co","PW":"stylestylebox"},"5":{"ID":"stylebox2u@gmail.com","PW":"abcstyle2u"},"6":{"ID":"style@bbox2u.com","PW":"bbox160523!"},"7":{"ID":"abcstylebox","PW":"abc160523!"},"7":{"ID":"abcstylebox","PW":"abc160523!"}}
var KeyList = Object.keys(ParseObj);
KeyList.forEach(function(EachKey){
        var eachitem = ParseObj[EachKey];
        var params = {
                TableName : tableName,
                Item : {
                        ID : eachitem.ID,
                        PW : eachitem.PW,
                        LoginNum : parseInt(EachKey)
                }
        };
        docClient.put(params,function(err,data){
                if (err) {
                         console.log("Error", err);
                 } else {
                        console.log("Success", data);
                 }
        });
});