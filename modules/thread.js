"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    verif = require("./verifying"),
    crypto = require("crypto"),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

exports.execute = (req, res) => {
    console.log(res);
    
    let payload = JSON.parse(req.body.payload),
        slackUserId = payload.user.id,
        oauthObj = auth.getOAuthObject(slackUserId);
    
    if (!verif.signVerification(req)){
        console.log('verification failed');
        return;
    }

    let replies = payload.message.replies,
        children = '',
        thread_id = payload.message.thread_ts,
        parent = false;

    //if (thread_id == payload.message.ts){
    //    thread_id = '';
    //}
    if (replies){
        parent = true;
    }

    force.create(oauthObj, "Slack_Conversation__c",
        {
            Channel__c: payload.channel.name,   
            Sender__c: payload.user.name,
            Timestamp__c: parseFloat(payload.message.ts.split('.')[0])*1000,
            Message_Text__c: payload.message.text,
            Insertion_Batch__c: payload.action_ts,
            Slack_Id__c: payload.message.ts,
            Thread_ID__c: payload.message.thread_ts,
            Is_Parent_Message__c: parent
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

};