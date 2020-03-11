"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    crypto = require("crypto"),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

exports.execute = (req, res) => {
    var hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    var timestamp = req.headers['x-slack-request-timestamp'];
    //console.log(timestamp*1000 + ' != ' + Date.now());
    if (Math.abs(Date.now() - timestamp*1000) > 60*5*1000){
        return;
    }
    var requestBody = convertToString(req.body);
    //console.log(requestBody);
    var version = 'v0';
    var baseString = version + ':' + timestamp + ':' + requestBody;
    //console.log(baseString);
    hmac.update(baseString);
    var hashedString = version + '=' + hmac.digest('hex');
    if (hashedString != req.headers['x-slack-signature']) {
        //console.log(hashedString + ' != ' + req.headers['x-slack-signature']);
        res.send("Invalid token");
        return;
    }

    let slackUserId = req.body.user_id,
        oauthObj = auth.getOAuthObject(slackUserId);

    force.whoami(oauthObj)
        .then(data => {
            let userInfo = JSON.parse(data);
            let attachments = [];
            let fields = [];
            fields.push({title: "Name", value: userInfo.name, short:true});
            fields.push({title: "Salesforce User Name", value: userInfo.preferred_username, short:true});
            attachments.push({color: "#65CAE4", fields: fields});
            res.json({text: "Your User Information:", attachments: attachments});
        })
        .catch(error => {
            if (error.code == 401) {
                res.send(`Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);
            } else {
                res.send("An error as occurred");
            }
        });


        function convertToString(input){
            var result = '';
            var keys = [];
            for (var i in input){
                keys.push(i);
            }
            for (var i = 0; i<keys.length;i++){
                result += keys[i]+'='+encodeURIComponent(input[keys[i]]).replace(/%26/g,'&');;
                if (i+1 != keys.length){
                    result += '&';
                }
            }
            return result;
        }
};