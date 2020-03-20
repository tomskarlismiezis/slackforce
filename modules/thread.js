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
    
    let payload = JSON.parse(req.body.payload),
        slackUserId = payload.user.id,
        oauthObj = auth.getOAuthObject(slackUserId);
    //console.log(payload);

    let requestBody = convertToString(payload),
        version = 'v0',
        baseString = version + ':' + timestamp + ':' + requestBody;
    //console.log(baseString);
    hmac.update(baseString);
    var hashedString = version + '=' + hmac.digest('hex');
    if (hashedString != req.headers['x-slack-signature']) {
        console.log(hashedString + ' != ' + req.headers['x-slack-signature']);
        res.send("Invalid token");
        return;
    }


    //console.log(payload);
    let replies = payload.message.replies,
        children = '',
        thread_id = payload.message.thread_ts;

    if (thread_id == payload.message.ts){
        thread_id = '';
    }

    for (var repl in replies){
        children :+ repl.ts + ';';
    }
    console.log(payload.message.ts.split('.'));

    force.create(oauthObj, "Slack_Conversation__c",
        {
            Channel__c: payload.channel.name,   
            Sender__c: payload.user.name,
            Timestamp__c: payload.message.ts.split('.')[0],
            Message_Text__c: payload.message.text,
            Insertion_Batch__c: payload.action_ts,
            Slack_Id__c: payload.message.ts,
            Thread_Messages__c: children,
            Thread_Under__c: thread_id
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
            console.log(error);
            if (error.code == 401) {
                res.send(`Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);

            } else {
                res.send("An error as occurred");
            }
        });


    function convertToString(input){
        var result = '';
        result += 'token=';
        result += (input.token);
        
        result += '&team_id=';
        result += (input.team.id);

        result += '&team_domain=';
        result += (input.team.domain);

        result += '&channel_id=';
        result += (input.channel.id);

        result += '&channel_name=';
        result += (input.channel.name);

        result += '&user_id=';
        result += (input.user.id);

        result += '&user_name=';
        result += (input.user.name)

        result += '&command=';
        result += (input.callback_id);

        result += '&text=';
        //result += encodeURIComponent(input.message.text);

        result += '&response_url=';
        result += encodeURIComponent(input.response_url);

        result += '&trigger_id=';
        result += (input.trigger_id);
        
        console.log(result);
        return result;
    }

};