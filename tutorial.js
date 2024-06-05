const { WebClient } = require('@slack/web-api');
// require('dotenv').config();
// MODIFIED (Wed, 27 Sep 2023 13:28:23 +0900)
require('asynchronous-context/env').config();
console.log( process.env.SLACK_TOKEN );
const web = new WebClient( process.env.SLACK_TOKEN );

const currentTime = new Date().toTimeString();

(async () => {

  try {
    // Use the `chat.postMessage` method to send a message from this app
    await web.chat.postMessage({
      channel: '#general',
      // text: `The current time is ${currentTime}`,
      text: `山川さん、ボットからの書き込みに成功致しました！`,
    });
    console.log('Message posted!');
  } catch (error) {
    console.log(error);
  }

})();

