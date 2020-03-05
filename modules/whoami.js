"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    crypto = require("crypto"),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

exports.execute = (req, res) => {

    var hmac = crypto.createHmac('sha256', SIGNING_SECRET);
    var timestamp = req.headers['X-Slack-Request-Timestamp'];
    if (Math.abs(Date.now() - timestamp) > 60*5*1000){
        return;
    }
    var requestBody = req.body;
    var version = 'v0';
    var baseString = version + ':' + timestamp + ':' + requestBody;
    var hashedString = version + '=' + hmac.digest('hex');

    if (hashedString != req.headers['X-Slack-Signature']) {
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
};