// eventPump.js
// Abstraction layer for handling internal Webex events
// and calling registered callbacks with data that aligns
// to the public webhooks

class EventPump {
  constructor(teams, messageEventCb, membershipEventCb) {
    try {
      this.messageEventCb =  (messageEventCb instanceof Function) ? messageEventCb : null;
      this.membershipEventCb =  (membershipEventCb instanceof Function) ? membershipEventCb : null;

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
    console.log(event);
    if (!event.data.activity.verb) {
      console.log('No activity verb to process event, ignoring');
      return;
    }

    let membership = {};
    let message = {};
    switch(event.data.activity.verb){
      case ("post"):
      case ("share"):
        console.log('Got a message created activity');
        // Message is encrypted.  We'll just send the message ID
        // so the client can GET the full unencyrpted message object
        try {
          message = {
            id: Buffer.from(
              'ciscospark://us/MESSAGE/'+event.data.activity.id).toString('base64').replace(/=*$/, ""),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
            // Not clear how to get roomType from Activity data  
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
            personEmail: event.data.activity.actor.emailAddress,
            personDisplayName: event.data.activity.actor.disaplayName,
            personOrgId: Buffer.from(
              'ciscospark://us/ORGANIZATION/'+event.data.activity.actor.orgId).toString('base64').replace(/=*$/, ""),
            // Not clear how to get isModerator from Activity data
            // Not clear how to get isMonitor from Activity data
            // Not clear how to get isRoomHidden from Activity data
            lastActivity: 'created',
            lastActivityDate:  new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client to fetch message ID: %s from room: %s',message.id, message.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        (this.messageEventCb) ? this.messageEventCb(message) : console.log('No app to send it to.');
        break;
        
      case ("delete"):
      case ("tombstone"):     // Its not clear what the difference is between these two
        console.log('Got an delete message activity');
        try {
          message = {
            id: Buffer.from(
              'ciscospark://us/MESSAGE/'+event.data.activity.object.id).toString('base64').replace(/=*$/, ""),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
            // Not clear how to get roomType from Activity data  
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
            personEmail: event.data.activity.actor.emailAddress,
            personDisplayName: event.data.activity.actor.disaplayName,
            personOrgId: Buffer.from(
              'ciscospark://us/ORGANIZATION/'+event.data.activity.actor.orgId).toString('base64').replace(/=*$/, ""),
            // Not clear how to get isModerator from Activity data
            // Not clear how to get isMonitor from Activity data
            // Not clear how to get isRoomHidden from Activity data
            lastActivity: 'deleted',
            lastActivityDate:  new Date(event.timestamp).toISOString() 
          };
          console.log('Will tell client to delete message ID: %s from room: %s',message.id, message.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        (this.messageEventCb) ? this.messageEventCb(message) : console.log('No app to send it to.');
        break;

      case ("add"):
        console.log('Got an new membership activity');
        try {
          membership = {
            id: Buffer.from(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id).toString('base64').replace(/=*$/, ""),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
            // roomType: not clear how to get this from activity
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64').replace(/=*$/, ""),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64').replace(/=*$/, ""),
            actorId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
            lastActivity: 'created',
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client delete a userId: %s to room: %s',
            membership.personDisplayName, membership.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        (this.membershipEventCb) ? this.membershipEventCb(membership) : console.log('No app to send it to.');
        break;
        
      case ("leave"):
        console.log('Got an membership deleted activity');
        try {
          membership = {
            id: Buffer.from(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id).toString('base64').replace(/=*$/, ""),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64').replace(/=*$/, ""),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.orgId).toString('base64').replace(/=*$/, ""),
            actorId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
            lastActivity: 'deleted',
            lastActivityDate: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client delete a userId: %s from room: %s',
            membership.personDisplayName, membership.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        (this.membershipEventCb) ? this.membershipEventCb(membership) : console.log('No app to send it to.');
        break;

      case ("acknowledge"):
        console.log('Got an acknowledge activity');
        // readReceipt = {
        //   id: Buffer.from(
        //     'ciscospark://us/ACTIVITY/'+event.data.activity.id).toString('base64').replace(/=*$/, ""),
        //   roomId: Buffer.from(
        //     'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
        //   messageId: Buffer.from(
        //     'ciscospark://us/MESSAGE/'+event.data.activity.object.id).toString('base64').replace(/=*$/, ""),
        //   personId: Buffer.from(
        //     'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
        //   personEmail: event.data.activity.actor.emailAddress,
        //   personDisplayName: event.data.activity.actor.displayName,
        //   personOrgId: Buffer.from(
        //     'ciscospark://us/PEOPLE/'+event.data.activity.actor.orgId).toString('base64').replace(/=*$/, ""),
        //   readDate: new Date(event.data.activity.published).toISOString()
        // };
        membership = {
          id: Buffer.from(
            'ciscospark://us/MEMBERSHIP/'+event.data.activity.id).toString('base64').replace(/=*$/, ""),
          roomId: Buffer.from(
            'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64').replace(/=*$/, ""),
          personId: Buffer.from(
            'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64').replace(/=*$/, ""),
          personEmail: event.data.activity.actor.emailAddress,
          personDisplayName: event.data.activity.actor.displayName,
          personOrgId: Buffer.from(
            'ciscospark://us/PEOPLE/'+event.data.activity.actor.orgId).toString('base64').replace(/=*$/, ""),
          lastActivity: 'read',
          lastReadId: Buffer.from(
            'ciscospark://us/MESSAGE/'+event.data.activity.object.id).toString('base64').replace(/=*$/, ""),
          lastActivityDate: new Date(event.timestamp).toISOString()
        };
        (this.membershipEventCb) ? this.membershipEventCb(membership) : console.log('No app to send it to.');
        break;

      default:
        console.log('Dont know what to do with activity type: '+ event.data.activity.verb);
    }
  }


}

module.exports = EventPump;

