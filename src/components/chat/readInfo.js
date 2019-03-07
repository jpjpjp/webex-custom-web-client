// readInfo.js
// Abstraction layer for sending activity events
// and getting member activity info for a space

const request = require('request-promise');


class ReadInfo {
  constructor(token) {
    this.token = token;
    this.reqOptions = {
      "uri": 'https://conv-a.wbx2.com/conversation/api/v1/activities?personRefresh=true',
      "method": 'POST',
      "json": true,
      headers: {
        'Authorization': 'Bearer '+this.token,
        'Content-Type': 'application/json'
      },
      body: {
        "verb":"acknowledge",
        "objectType":"activity",
        "actor":{
          "entryUUID":""
        },
        "object":{
          "objectType":"activity",
          "id":""
        },
        "target":{
          "id":"819030f0-4051-11e9-911e-f17c3255ce9a",
          "objectType":"conversation",
          "activities":{
            "items":[]
          },
          "participants":{
            "items":[]
          }
        }
      }
    };
  }

  /**
   * Send a read reciept that indicates the current user has read
   * all the messages in the space
   *
   * @function sendReadReciept
   * @param {object} event - Internal Webex event to process
   */
  sendReadReciept(actorId, objectId, targetId) {
    this.reqOptions.body.actor.id = this.getUUID(actorId);
    this.reqOptions.body.object.id = this.getUUID(objectId);
    this.reqOptions.body.target.id = this.getUUID(targetId);
    request(this.reqOptions).then(resp => {
      console.log(resp);
    }).catch(err => {
      alert('Failed to send read receipt to Webex: '+err.message);
    });
  }

  /**
   * Convenience method for pulling the UUID out of 
   * a public ID
   *
   * @function getUUID
   * @param {string} id - Public ID to extract from
   */
  getUUID(id) {
    let internalId = Buffer.from(id, 'base64').toString('utf8');
    return(internalId.substr(internalId.lastIndexOf("/")+1));
  }
}

module.exports = ReadInfo;

