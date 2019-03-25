// readInfo.js
// Abstraction layer for sending activity events
// and getting member activity info for a space

const request = require('request');
const b64 = require('base-64');


class ReadInfo {
  constructor(token) {
    this.token = token;
    this.ackOptions = {
      "uri": 'https://conv-a.wbx2.com/conversation/api/v1/activities',
      "method": 'POST',
      "json": true,
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Content-Type': 'application/json'
      },
      body: {
        "verb": "acknowledge",
        "objectType": "activity",
        "actor": {
          "entryUUID": ""
        },
        "object": {
          "objectType": "activity",
          "id": ""
        },
        "target": {
          "id": "",
          "objectType": "conversation",
          "activities": {
            "items": []
          },
          "participants": {
            "items": []
          }
        }
      }
    };
    this.spaceInfoUri = 'https://conv-a.wbx2.com/conversation/api/v1/conversations/';
    this.spaceInfoOptions = {
      "method": 'GET',
      "json": true,
      headers: {
        'Authorization': 'Bearer ' + this.token,
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
        'Authorization': 'Bearer ' + this.token,
        'Accept': 'application/json'
      },
      qs: {
        activitiesLimit: 0,     // don't send the whole history of activity
        participantsLimit: 0,  // don't send participant detail
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
    return new Promise((resolve, reject) => {
      request(this.readStatusOptions, function (error, resp) {
        try {
          if (error) {throw(error);}
          if (resp.statusCode != 200) {
            throw(new Error('getReadStatus: lookup returned '+resp.statusCode+
              ': '+resp.statusMessage));
          }
          let readStatusInfo = {items: []};
          // Grab the couple of salient fields for the external array
          if ((resp) && (resp.body) && (resp.body.items)) {
            for (let index in resp.body.items) {
              let space = resp.body.items[index];
              let spaceInfo = {};
              if (space.id) {
                spaceInfo.roomId = b64.encode('ciscospark://us/ROOM/'+space.id);            
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
          } else {
            throw new Error('getReadStatus: Unable to parse response from Webex');
          }     
          return resolve(readStatusInfo);
        } catch(err)  {
          console.error('Failed to fetch read status for spaces: '+err.message);
          return reject(err);
        };
      });
    });
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
    return new Promise((resolve, reject) => {
      request(this.spaceInfoOptions, function (error, resp) {
        try{
          console.log(resp);
          if (error) {throw(error);}
          if (resp.statusCode != 200) {
            throw(new Error('getSpaceInfo: lookup returned '+resp.statusCode+
              ': '+resp.statusMessage));
          }
          let lastReadInfo = { items: [] };
          if ((resp) && (resp.participants) && (resp.participants.items)) {
            // We keep track of the last read message by each user
            for (let index in resp.participants.items) {
              let participant = resp.participants.items[index];
              let participantInfo = {};
              if (participant.entryUUID) {
                participantInfo.personId = b64.encode(
                  'ciscospark://us/PEOPLE/' + participant.entryUUID);
              }

              if (participant.roomProperties) {
                if (participant.roomProperties.lastSeenActivityUUID) {
                  participantInfo.lastSeenId = b64.encode(
                    'ciscospark://us/MESSAGE/' + participant.roomProperties.lastSeenActivityUUID);
                }
                if (participant.roomProperties.lastSeenActivityDate) {
                  participantInfo.lastSeenDate = participant.roomProperties.lastSeenActivityDate;
                }
              }
              lastReadInfo.items = lastReadInfo.items.concat(participantInfo);
            }
          }
          return resolve(lastReadInfo);
        }catch(err) {
          console.log('Failed to fetch read receipt info for new space: ' + err.message);
          return reject(err);
        }
      });
    });
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
    request(this.ackOptions, function (error, resp) {
      try {
        if (error) {throw(error);}
        console.log(resp);
        if (resp.statusCode != 200) {
          throw(new Error('sendReadReciept: returned '+resp.statusCode+
            ': '+resp.statusMessage));
        }
      } catch(err) {
        console.error('Failed to send read receipt to Webex: ' + err.message);
      }
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
    let internalId = b64.decode(id);
    return (internalId.substr(internalId.lastIndexOf("/") + 1));
  }
}

module.exports = ReadInfo;

