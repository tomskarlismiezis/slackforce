"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    crypto = require("crypto"),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

exports.execute = (req, res) => {
    //console.log('thread being executed');
    var hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    var timestamp = req.headers['x-slack-request-timestamp'];
    //console.log(timestamp*1000 + ' != ' + Date.now());
    if (Math.abs(Date.now() - timestamp*1000) > 60*5*1000){
        return;
    }
    var requestBody = convertToString(req.body);
    var version = 'v0';
    var baseString = version + ':' + timestamp + ':' + requestBody;
    //console.log(baseString);
    hmac.update(baseString);
    var hashedString = version + '=' + hmac.digest('hex');
    //if (hashedString != req.headers['x-slack-signature']) {
        //console.log(hashedString + ' != ' + req.headers['x-slack-signature']);
        //res.send("Invalid token");
        //return;
    //}

    let slackUserId = req.body.user_id,
        oauthObj = auth.getOAuthObject(slackUserId),
        payload = JSON.parse(req.body.payload);

    //console.log(payload);
    let replies = payload.message.replies;
    for (var repl in replies){
        //console.log(replies);
    }

    force.create(oauthObj, "Slack_Conversation__c",
        {
            Channel__c: payload.channel.name,   
            Sender__c: payload.user.name,
            Timestamp__c: payload.message.ts.split('.')[0],
            Message_Text__c: payload.message.text,
            Insertion_Batch__c: payload.action_ts
        })
        .then(data => {
            let fields = [];
            fields.push({title: "make sure to add the correct case in Salesforce:", value: oauthObj.instance_url + "/" + data.id, short:false});
            let message = {
                text: 'Message created, ',
                attachments: [
                    {color: "#F2CF5B", fields: fields}
                ]
            };
            res.json(message);
        })
        .catch((error) => {
            if (error.code == 401) {
                res.send(`Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);

            } else {
                console.log(error);
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
            if (keys[i] == 'response_url'){
                result += keys[i]+'='+encodeURIComponent(input[keys[i]]).replace(/%26/g,'&');;
            } else {
                result += keys[i]+'='+input[keys[i]];
            }
            if (i+1 != keys.length){
                result += '&';
            }
        }
        return result;
    }

};