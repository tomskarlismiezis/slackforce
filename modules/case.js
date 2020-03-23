"use strict";

let auth = require("./slack-salesforce-auth"),
    force = require("./force"),
    verif = require("./verifying");

exports.execute = (req, res) => {
    console.log(res);
    if (!verif.signVerification(req)){
        console.log('verification failed');
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
            if (keys[i] == 'response_url' || keys[i]=='text'){
                result += keys[i]+'='+encodeURIComponent(input[keys[i]]);
            } else {
                result += keys[i]+'='+input[keys[i]];
            }
            if (i+1 != keys.length){
                result += '&';
            }
        }
        console.log(result);
        return result;
    }
    
    function signVerification(req){
        let res = false;
        let slackSignature = req.headers['x-slack-signature'];
        let requestBody = qs.stringify(req.body, {format : 'RFC1738'});
        let timestamp = req.headers['x-slack-request-timestamp'];
        let time = Math.floor(new Date().getTime()/1000);
        if (Math.abs(time - timestamp) > 300) {
            res = false;
            return res;
        }
        if (!SIGNING_SECRET) {
            res = false;
            console.log('Signing secret is empty');
            return res;
        }
        let sigBasestring = 'v0:' + timestamp + ':' + requestBody;
        let mySignature = 'v0=' + 
                       crypto.createHmac('sha256', SIGNING_SECRET)
                             .update(sigBasestring, 'utf8')
                             .digest('hex');
        if (crypto.timingSafeEqual(
                   Buffer.from(mySignature, 'utf8'),
                   Buffer.from(slackSignature, 'utf8'))
           ) 
           {
            res = true;
        }
        return res;
     }
};