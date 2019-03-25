// eventPump.js
// Abstraction layer for handling internal Webex events
// and calling registered callbacks with data that aligns
// to the public webhooks
const b64 = require('base-64');

class EventPump {
  constructor(teams, messageEventCb, membershipEventCb, roomEventCb) {
    try {
      this.messageEventCb =  (messageEventCb instanceof Function) ? messageEventCb : null;
      this.membershipEventCb =  (membershipEventCb instanceof Function) ? membershipEventCb : null;
      this.roomEventCb =  (roomEventCb instanceof Function) ? roomEventCb : null;

      // Register to get SDK Internal events
      teams.internal.device.register();
      teams.internal.mercury.on('event:conversation.activity', (event) => { this.processEvent(event); });
      teams.internal.mercury.connect();        
    } catch(err) {
      logger.error('Cannot read Jira config from environment: '+err.message);
      throw(err);
    }
  }

  /**
   * Analyze the events coming in and see which ones our client cares about
   *
   * @function processEvent
   * @param {object} event - Internal Webex event to process
   */
  processEvent(event) {
    try {
      console.log(event);
      if ((!event) || (!event.data) || (!event.data.activity) || (!event.data.activity.verb)) {
        let msg = 'EventPump: Received event with no activity verb to process, ignoring';
        (this.messageEventCb) ? this.messageEventCb(new Error(msg)) : console.error(msg);
        return;
      }

      let membership = {};
      let message = {};
      let room = {};
      switch(event.data.activity.verb) {
        case ("post"):
        case ("share"):
          console.log('Got a message created activity');
          // Message is encrypted.  We'll just send the message ID
          // so the client can GET the full unencyrpted message object
          message = {
            id: b64.encode(
              'ciscospark://us/MESSAGE/'+event.data.activity.id),
            roomId: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.target.id),
            // Not clear how to get roomType from Activity data  
            personId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            personEmail: event.data.activity.actor.emailAddress,
            personDisplayName: event.data.activity.actor.disaplayName,
            personOrgId: b64.encode(
              'ciscospark://us/ORGANIZATION/'+event.data.activity.actor.orgId),
            // Not clear how to get isModerator from Activity data
            // Not clear how to get isMonitor from Activity data
            // Not clear how to get isRoomHidden from Activity data
            lastActivity: 'created',
            lastActivityDate:  new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client to fetch message ID: '+message.id+' from room: '+message.roomId);
          (this.messageEventCb) ? this.messageEventCb(null, message) : 
            console.error('Missing callback for to send message event to.');
          break;
        
        case ("delete"):
        case ("tombstone"):     // Its not clear what the difference is between these two
          console.log('Got an delete message activity');
          message = {
            id: b64.encode(
              'ciscospark://us/MESSAGE/'+event.data.activity.object.id),
            roomId: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.target.id),
            // Not clear how to get roomType from Activity data  
            personId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            personEmail: event.data.activity.actor.emailAddress,
            personDisplayName: event.data.activity.actor.disaplayName,
            personOrgId: b64.encode(
              'ciscospark://us/ORGANIZATION/'+event.data.activity.actor.orgId),
            // Not clear how to get isModerator from Activity data
            // Not clear how to get isMonitor from Activity data
            // Not clear how to get isRoomHidden from Activity data
            lastActivity: 'deleted',
            lastActivityDate:  new Date(event.timestamp).toISOString() 
          };
          console.log('Will tell client to delete message ID: '+message.id+' from room: '+message.roomId);
          (this.messageEventCb) ? this.messageEventCb(null, message) : 
            console.error('Missing callback for to send message event to.');
          break;

        case ("add"):
          console.log('Got an new membership activity');
          membership = {
            id: b64.encode(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id),
            roomId: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.target.id),
            // roomType: not clear how to get this from activity
            personId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID),
            actorId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            lastActivity: 'created',
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client add a user: '+membership.personDisplayName+' to room: '+
            membership.roomId);
          (this.membershipEventCb) ? this.membershipEventCb(null, membership) : 
            console.error('Missing callback for to send membership event to.');
          break;
          
        case ("leave"):
          console.log('Got an membership deleted activity');
          membership = {
            id: b64.encode(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id),
            roomId: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.target.id),
            personId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.orgId),
            actorId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            lastActivity: 'deleted',
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client delete a user: '+membership.personDisplayName+' from room: '+
            membership.roomId);
          (this.membershipEventCb) ? this.membershipEventCb(null, membership) : 
            console.error('Missing callback for to send membership event to.');
          break;

        case ("acknowledge"):
          console.log('Got an acknowledge activity');
          membership = {
            id: b64.encode(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id),
            roomId: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.target.id),
            personId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            personEmail: event.data.activity.actor.emailAddress,
            personDisplayName: event.data.activity.actor.displayName,
            personOrgId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.orgId),
            lastActivity: 'updated',
            lastSeenId: b64.encode(
              'ciscospark://us/MESSAGE/'+event.data.activity.object.id),
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          (this.membershipEventCb) ? this.membershipEventCb(null, membership) : 
            console.error('Missing callback for to send membership read receipt event to.');
          break;

        case ("create"):
          console.log('Got an new room activity');
          room = {
            id: b64.encode(
              'ciscospark://us/ROOM/'+event.data.activity.object.id),
            // title: not clear how to get this from activity  
            // type: not clear how to get this from activity
            // isLocked: not clear how to get this from activity
            // teamId: not clear how to get this from activity
            creatorId: b64.encode(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID),
            lastActivity: 'created',
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client that their user is in a new room with id: '+room.id);
          (this.roomEventCb) ? this.roomEventCb(null, room) : 
            console.error('Missing callback for room events.');
          break;
          
        default:
          let msg = 'EventPump: Ignoring activity with verb type: '+ event.data.activity.verb;
          (this.messageEventCb) ? this.messageEventCb(new Error(msg)) : console.error(msg);
      }
    } catch(e) {
      let msg = 'EventPump: Failed getting data from event: '+e.message;
      (this.messageEventCb) ? this.messageEventCb(new Error(msg)) : console.error(msg);
    }
  }

}

module.exports = EventPump;

