// readInfo.js
// Abstraction layer for sending activity events
// and getting member activity info for a space

const request = require('request-promise');


class ReadInfo {
  constructor(token) {
    this.token = token;
    this.ackOptions = {
      "uri": 'https://conv-a.wbx2.com/conversation/api/v1/activities',
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
          "id":"",
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
    this.spaceInfoUri = 'https://conv-a.wbx2.com/conversation/api/v1/conversations/';
    this.spaceInfoOptions = {
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
    this.readStatusOptions = {
      "uri": 'https://conv-a.wbx2.com/conversation/api/v1/conversations/',
      "method": 'GET',
      "json": true,
      headers: {
        'Authorization': 'Bearer '+this.token,
        'Accept': 'application/json'
      },
      qs: {
        activitiesLimit: 0,     // don't send the whole history of activity
        participantsLimit: 0 ,  // don't send participant detail
        isActive: true,         // don't send info on "hidden" rooms                
      }
    };
  }

  /**
   * Fetch the read status for all the rooms
   *
   * Returns an array of space info that includes
   *   -- roomId - ID of the space 
   *   -- lastSeenDate -- timestamp of last read receipt for user
   *   -- lastActivityDate -- timestamp of last activity in space
   * 
   * For spaces where lastActivityDate > lastSeenDate the space
   * can be considerd to be "unread"
   *
   * @function getReadStatus
   */
  getReadStatus() {
    return (request(this.readStatusOptions).then(resp => {
      let readStatusInfo = {items: []};
      if ((resp) && (resp.items)) {
        // Grab the couple of salient fields for the external array
        for (let index in resp.items) {
          let space = resp.items[index];
          let spaceInfo = {};
          if (space.id) {
            spaceInfo.roomId = Buffer.from(
              'ciscospark://us/ROOM/'+space.id).toString('base64').replace(/=*$/, "");
            if (space.lastSeenActivityDate) {
              spaceInfo.lastSeenDate = space.lastSeenActivityDate;
            } else {
              // If user has never been seen set the date to "a long time ago"
              spaceInfo.lastSeenDate = new Date(0).toISOString();
            }
            if (space.lastReadableActivityDate) {
              spaceInfo.lastActivityDate = space.lastReadableActivityDate;
            } else {
              if (space.lastRelevantActivityDate) {
                spaceInfo.lastActivityDate = space.lastRelevantActivityDate;
              } else {
                console.error('getReadStatus: Cannot read last activity date for a space: '+spaceInfo.roomId+'.  Ignoring');
                continue;
              }
            }
          } else {
            console.error('getReadStatus: Cannot get space ID.  Ignoring element');
            continue;
          }
          readStatusInfo.items = readStatusInfo.items.concat(spaceInfo);
        } 
      }     
      return Promise.resolve(readStatusInfo);
    }).catch(err => {
      console.log('Failed to fetch read status for spaces: '+err.message);
      return Promise.reject(err);
    }));
  }

  /**
   * Fetch the most recent activity info for each room participant
   * 
   * Returns an array of membership info that includes
   *   -- personId - ID of the space member
   *   -- lastSeenId -- ID of the last message read in space
   *   -- lastSeenDate -- timestamp of last read receipt event
   *
   * @function getSpaceInfo
   * @param {string} roomId - ID of the space we are interested in
   */
  getSpaceInfo(roomId) {
    this.spaceInfoOptions.uri = this.spaceInfoUri + this.getUUID(roomId);
    return (request(this.spaceInfoOptions).then(resp => {
      console.log(resp);
      let lastReadInfo = {items: []};
      if ((resp) && (resp.participants) && (resp.participants.items)) {
        // We keep track of the last read message by each user
        for (let index in resp.participants.items) {
          let participant = resp.participants.items[index];
          let participantInfo = {};
          if (participant.entryUUID) {
            participantInfo.personId = Buffer.from(
              'ciscospark://us/PEOPLE/'+participant.entryUUID).toString('base64').replace(/=*$/, "");
          }
          if (participant.roomProperties) {
            if (participant.roomProperties.lastSeenActivityUUID) {
              participantInfo.lastSeenId = Buffer.from(
                'ciscospark://us/MESSAGE/'+participant.roomProperties.lastSeenActivityUUID).toString('base64').replace(/=*$/, "");
            }
            if (participant.roomProperties.lastSeenActivityDate) {
              participantInfo.lastSeenDate = participant.roomProperties.lastSeenActivityDate;
            }
          }
          lastReadInfo.items = lastReadInfo.items.concat(participantInfo);
        } 
      }     
      return Promise.resolve(lastReadInfo);
    }).catch(err => {
      console.log('Failed to fetch read receipt info for new space: '+err.message);
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
  sendReadReciept(personId, messageId, roomId) {
    this.ackOptions.body.actor.id = this.getUUID(personId);
    this.ackOptions.body.object.id = this.getUUID(messageId);
    this.ackOptions.body.target.id = this.getUUID(roomId);
    request(this.ackOptions).then(resp => {
      console.log(resp);
    }).catch(err => {
      console.error('Failed to send read receipt to Webex: '+err.message);
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

