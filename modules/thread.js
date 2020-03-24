"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    verif = require("./verifying"),
    request = require("request");

function postMessage(url, text){
    var options = {
        "url": url,
        "method":'POST',
        "headers" :{
            "content-type": "application/json"
        },
        "body":{
            "text": text,
            "response_type": "ephemeral"
        }
    }
    
}

exports.execute = (req, res) => {
    let payload = JSON.parse(req.body.payload),
        slackUserId = payload.user.id,
        oauthObj = auth.getOAuthObject(slackUserId);
    
    if (!verif.signVerification(req)){
        console.log('verification failed');
        return;
    }

    let replies = payload.message.replies,
        parent = false,
        response_url = payload.response_url;

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
            let message = "Message created, make sure to add the correct case in Salesforce: " + oauthObj.instance_url + "/" + data.id;
            postMessage(response_url, message);
            res.json(message);
        
        })
        .catch((error) => {
            if (error.code == 401) {
                res.send(`Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);
                
                postMessage(response_url, `Visit this URL to login to Salesforce: https://${req.hostname}/login/` + slackUserId);

            } else {
                console.log(error);
                res.send("An error as occurred");
                postMessage(response_url, "An error as occurred");
            }
        });

};