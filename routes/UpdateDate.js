var fs = require('fs')
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
TodayDate = year + '-' + month + '-' + day;
var UpdateDate = {
    update_date: function (req, res) {
        console.log('Update date');
        var json_data = JSON.parse(fs.readFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json').toString());
        json_data['lastupdatedate']=TodayDate;
        fs.writeFileSync('/Users/maminji/development/Stylebox_ManageWeb/public/json/LastUpdateDate.json', JSON.stringify(json_data), 'utf-8');
    }
};
module.exports = UpdateDate;