const crypto = require('crypto');
const qs = require('qs');
// fetch this from environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
let signVerification = (req) => {
    let res = false;
   let slackSignature = req.headers['x-slack-signature'];
   let requestBody = qs.stringify(req.body, {format : 'RFC1738'});
   let timestamp = req.headers['x-slack-request-timestamp'];
   let time = Math.floor(new Date().getTime()/1000);
   if (Math.abs(time - timestamp) > 300) {
       res = false;
       return res;
   }
   if (!slackSigningSecret) {
       res = false;
       console.log('Signing secret is empty');
       return res;
   }
   let sigBasestring = 'v0:' + timestamp + ':' + requestBody;
   let mySignature = 'v0=' + 
                  crypto.createHmac('sha256', slackSigningSecret)
                        .update(sigBasestring, 'utf8')
                        .digest('hex');
   if (crypto.timingSafeEqual(
              Buffer.from(mySignature, 'utf8'),
              Buffer.from(slackSignature, 'utf8'))
      ) {
          next();
   } else {
          res = true;
   }
   return res;
}
module.exports = signVerification;