"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    crypto = require("crypto"),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

exports.execute = (req, res) => {
    var hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    var timestamp = req.headers['x-slack-request-timestamp'];
    console.log(timestamp*1000 + ' != ' + Date.now());
    if (Math.abs(Date.now() - timestamp*1000) > 60*5*1000){
        return;
    }
    var requestBody = convertToString(req.body);
    console.log(requestBody);
    var version = 'v0';
    var baseString = version + ':' + timestamp + ':' + requestBody;
    console.log(baseString);
    hmac.update(baseString);
    var hashedString = version + '=' + hmac.digest('hex');
    if (hashedString != req.headers['x-slack-signature']) {
        console.log(hashedString + ' != ' + req.headers['x-slack-signature']);
        res.send("Invalid token");
        return;
    }

    let slackUserId = req.body.user_id,
        oauthObj = auth.getOAuthObject(slackUserId),
        params = req.body.text.split(":"),
        subject = params[0],
        description = params[1];
        for (var i = 2;i<params.length;i++){
            description += ':' + params[i]; // in case there are :'s in description
        }

    force.create(oauthObj, "Case",
        {
            subject: subject,
            description: description,
            origin: "Slack",
            status: "New"
        })
        .then(data => {
            let fields = [];
            fields.push({title: "Subject", value: subject, short:false});
            fields.push({title: "Description", value: description, short:false});
            fields.push({title: "Open in Salesforce:", value: oauthObj.instance_url + "/" + data.id, short:false});
            let message = {
                text: "A new case has been created:",
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