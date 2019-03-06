// eventPump.js
// Abstraction layer for handling
// Webex events

class EventPump {
  constructor(teams, messageCreatedFn, messageDeletedFn, membershipCreatedFn, membershipDeletedFn) {
    try {
      this.messageCreatedFn = messageCreatedFn;
      this.messageDeletedFn = messageDeletedFn;
      this.membershipCreatedFn = membershipCreatedFn;
      this.membershipDeletedFn = membershipDeletedFn;

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

    let id = '';
    let roomId = '';
    let membership = {};
    switch(event.data.activity.verb){
      case ("post"):
        console.log('Got a message activity');
        try {
          id = Buffer.from(
            'ciscospark://us/MESSAGE/'+event.data.activity.id).toString('base64');
          roomId = Buffer.from(
            'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64');
          console.log('Will tell client to fetch message ID: %s from room: %s',id, roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        this.messageCreatedFn(id, roomId);
        break;
        
      case ("delete"):
        console.log('Got an delete activity');
        try {
          id = Buffer.from(
            'ciscospark://us/MESSAGE/'+event.data.activity.id).toString('base64');
          roomId = Buffer.from(
            'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64');
          console.log('Will tell client to delete message ID: %s from room: %s',id, roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        this.messageDeletedFn(id, roomId);
        break;

      case ("add"):
        console.log('Got an new membership activity');
        try {
          membership = {
            id: Buffer.from(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id).toString('base64'),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64'),
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64'),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64'),
            actorId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64'),
            created: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client delete a userId: %s to room: %s',
            membership.personDisplayName, membership.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        this.membershipCreatedFn(membership);
        break;
        
      case ("leave"):
        console.log('Got an membership deleted activity');
        try {
          membership = {
            id: Buffer.from(
              'ciscospark://us/MEMBERSHIP/'+event.data.activity.id).toString('base64'),
            roomId: Buffer.from(
              'ciscospark://us/ROOM/'+event.data.activity.target.id).toString('base64'),
            personId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64'),
            personEmail: event.data.activity.object.emailAddress,
            personDisplayName: event.data.activity.object.displayName,
            personOrgId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.object.entryUUID).toString('base64'),
            actorId: Buffer.from(
              'ciscospark://us/PEOPLE/'+event.data.activity.actor.entryUUID).toString('base64'),
            deleted: new Date(event.timestamp).toISOString()
          };
          console.log('Will tell client delete a userId: %s from room: %s',
            membership.personDisplayName, membership.roomId);
        } catch(e) {
          console.log('Failed getting data from event: '+e.message);
        }
        this.membershipDeletedFn(membership);
        break;

      case ("acknowledge"):
        console.log('Got an acknowledge activity');
        break;

      default:
        console.log('Dont know what to do with activity type: '+ event.data.activity.verb);
    }
  }


}

module.exports = EventPump;

