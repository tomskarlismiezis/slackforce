const crypto = require('crypto'),
    qs = require('qs'),
    SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;


module.exports = {
    signVerification : function(req){
        //credit to Rajat Srivastava - https://medium.com/@rajat_sriv/verifying-requests-from-slack-using-node-js-69a8b771b704 
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
}