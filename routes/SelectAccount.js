var fs = require('fs')

var SelectAcount = {
    selectaccount: function () {
        var ID,PW;
        var json_data = JSON.parse(fs.readFileSync('public/json/accoutlist.json').toString());
        var NumList = Object.keys(json_data);
        ID = json_data[NumList[0]]['ID'];
        PW = json_data[NumList[0]]['PW'];
        // json_data['tmp'] = json_data[NumList[0]]
        for(var i=0;i<NumList.length-1;i++){
            json_data[NumList[i]] = json_data[NumList[i+1]]
        }
        json_data[NumList[NumList.length-1]]['ID'] = ID;
        json_data[NumList[NumList.length-1]]['PW'] = PW;
        fs.writeFileSync('public/json/accoutlist.json', JSON.stringify(json_data), 'utf-8');
        return [ID,PW]
    }
};
module.exports = SelectAcount;