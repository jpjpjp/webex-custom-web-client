// sendFileMessage.js
// Abstraction layer for a message with a file attachment

//const request = require('request-promise');
//var fs = require("browserify-fs");
//var fetch = require('whatwg-fetch');

class SendFileMessage {
  constructor(token) {
    this.token = token;
    this.options = {
      "uri": 'https://api.ciscospark.com/v1/messages',
      "method": 'POST',
      headers: {
        'Authorization': 'Bearer '+this.token,
        // Needed when using request lib, but not when using fetch
        //'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      }
    };
  }

  /**
   * Post a message with a file attachement to the /messages API
   *
   * @function sendMessageWithFile
   * @param {object} message - A message option which includes the following fields
   *  -- roomId - required -- room to post message to
   *  -- file - required -- a file specified via an HTML input type=file form
   *  -- text - optional --  message text, this parameter is ignored if markdown is provided
   *  -- markdown - optional -- markdown formatted text
   */
  sendMessageWithFile(message) {
    return new Promise((resolve, reject) => {
      try {
        if ((!message.roomId) || (!message.file)) {
          let msg = (message.roomId) ? 'filePath' : 'roomId';
          return reject(new Error('sendMessageWithFile: missing required parameter: '+ msg));
        }

        let formData = new FormData();
        formData.append("files", message.file);
        formData.append("roomId", message.roomId);
        if (message.text) {formData.append('markdown', message.text);}
        if (message.markdown) {formData.append('markdown', message.markdown);}

        window.fetch(this.options.uri, 
          {method: this.options.method, headers: this.options.headers, body: formData}).then(r => 
        {
          r.json().then(body => {
            console.log(body);
            if (r.status === 200) {
              return resolve(body);
            } else {
              if ((body) && (body.message) && (body.trackingId)) {
                let respMsg = body.message + ', Tracking ID: ' + body.trackingId;
                return reject(new Error('sendFileMessage: Webex /messages API returned: '+respMsg));
              } else {
                return reject(new Error('sendFileMessage: Webex /messages API returned: '+r.status));
              }
            }
          }).catch(e => {
            console.log(e.message);
            return reject(e);
          });
        }).catch(e => {
          return reject(e);
        });
      } catch(e) {
        return reject(e);
      }
    });
  }

  /* This method using request worked with node
   * but did not work in a browser

  sendMessageWithFile(message) {
    return new Promise((resolve, reject) => {
      try {
        if ((!message.roomId) || (!message.file)) {
          let msg = (message.roomId) ? 'filePath' : 'roomId';
          return reject(new Error('sendMessageWithFile: missing required parameter: '+ msg));
        }

        let formData = { 
          roomId: message.roomId,
          files: { 
            value: fs.createReadStream(message.filePath),
            options: { 
              filename: message.filePath,
              contentType: null
            }
          }
        };
        if (message.text) { formData.text = message.text; }
        if (message.markdown) { formData.markdown = message.markdown; }
        this.options.formData = formData;        // this.options.formData = formData;

        request(this.options).then(resp => {
          console.log(resp);
          return resolve(resp);
        }).catch(e => {
          return reject(e);
        });
      } catch(e) {
        return reject(e);
      }
    });
  }
  */    
}

module.exports = SendFileMessage;
/*
 * Tests used to validate the node method...
 
let sendFileMessage = new SendFileMessage('MjI4YTgwZjAtZGQ1MS00MTRjLWIxNDEtZTdkZDkyMTdkZjFhMWM1MjZiMmUtNTI5');
let message = {
  roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYmM5ZjJiNzAtNDE1ZS0xMWU5LThkYmQtZDkyOGM5OGNiOTcy',
  filePath: '/Users/jshipher/Temp/download.png',
  text: 'Make it pretty'
};

sendFileMessage.sendMessageWithFile(message).then((msg) => {
  console.log('Got a message back!');
  message.text = 'Same message with text';
  return sendFileMessage.sendMessageWithFile(message);
}).then((msg) => {
  console.log('Got a message back!');
  message.markdown = '**Same message with markdown**';
  return sendFileMessage.sendMessageWithFile(message);
}).then((msg) => {
  console.log('Got a message back!');
  delete message.filePath;
  return sendFileMessage.sendMessageWithFile(message);
}).catch((e) => console.error(e.message));
*/