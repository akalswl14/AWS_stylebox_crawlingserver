var fs = require('fs')

var downloadcrawling = require('./FeedDownload');

var MakeDownloadRequest = {
    makejson: function (req, res) {
        QueryList = req.body;
        tmpList = Object.keys(QueryList);
        KeyList = new Array();
        for (var i in tmpList) {
            if (tmpList[i] == 'act_button' || tmpList[i] == 'chkall') {
                continue
            }
            KeyList.push(tmpList[i]);
        }
        var json_data = {}
        for (var i in KeyList) {
            var key = KeyList[i]
            var ValueList;
            if (typeof (QueryList[key]) == 'string') {
                ValueList = new Array(QueryList[key]);
            } else {
                ValueList = QueryList[key];
            }
            json_data[key] = ValueList;
        }
        // fs.writeFileSync('public/json/DownloadRequest.json', JSON.stringify(json_data), 'utf-8');
        downloadcrawling.runcrawling(json_data,res)
    }
};
module.exports = MakeDownloadRequest;