// readInfo.js
// Abstraction layer for sending activity events
// and getting member activity info for a space

const request = require('request-promise');


class ReadInfo {
  constructor(token) {
    this.token = token;
    this.ackOptions = {
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
    this.fetchUri = 'https://conv-a.wbx2.com/conversation/api/v1/conversations/';
    this.fetchOptions = {
      "method": 'GET',
      "json": true,
      headers: {
        'Authorization': 'Bearer '+this.token,
        'Accept': 'application/json'
      },
      qs: {
        participantAckFilter: "all",  // show lastAck info for each participant
        activitiesLimit: 0            // don't send the whole history of activity
      }
    };
  }

  /**
   * Fetch the most recent activity info for each room participant
   *
   * @function getSpaceInfo
   * @param {string} roomId - ID of the space we are interested in
   */
  getSpaceInfo(roomId) {
    this.fetchOptions.uri = this.fetchUri + this.getUUID(roomId);
    return (request(this.fetchOptions).then(resp => {
      console.log(resp);
      let lastReadInfo = [];
      if ((resp) && (resp.participants) && (resp.participants.items)) {
        // We keep track of the last read message by each user
        for (let index in resp.participants.items) {
          let participant = resp.participants.items[index];
          if ((participant.roomProperties) && (participant.roomProperties.lastSeenActivityUUID)) {
            lastReadInfo = lastReadInfo.concat({
              personId: Buffer.from(
                'ciscospark://us/PEOPLE/'+participant.entryUUID).toString('base64').replace(/=*$/, ""),
              messageId: Buffer.from(
                'ciscospark://us/MESSAGE/'+participant.roomProperties.lastSeenActivityUUID).toString('base64').replace(/=*$/, "")
            });
          }
        } 
      }     
      return Promise.resolve(lastReadInfo);
    }).catch(err => {
      alert('Failed to fetch read receipt info for new space: '+err.message);
      return Promise.reject(err);
    }));
  }

  /**
   * Send a read reciept that indicates the current user has read
   * all the messages in the space
   *
   * @function sendReadReciept
   * @param {object} event - Internal Webex event to process
   */
  sendReadReciept(actorId, objectId, targetId) {
    this.ackOptions.body.actor.id = this.getUUID(actorId);
    this.ackOptions.body.object.id = this.getUUID(objectId);
    this.ackOptions.body.target.id = this.getUUID(targetId);
    request(this.ackOptions).then(resp => {
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

