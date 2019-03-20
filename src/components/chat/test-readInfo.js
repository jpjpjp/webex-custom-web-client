// test-readInfo.js
// node app to demonstrate the use of the 
// readInfo and eventPump modules

//import { init as initTeams } from 'ciscospark';
var webexSdk = require('ciscospark');
var EventPump = require('webex-js-eventpump');
var ReadInfo = require('webex-read-info');
var moment = require('moment');

// Read token from env
let token = '';
if (process.env.WEBEX_TOKEN) {
  token = process.env.WEBEX_TOKEN;
} else {
  console.error('Set the environment variable WEBEX_TOKEN to a valid webex user auth token');
  process.exit();
}

let myAppInfo = {
  teams: {},
  myPersonId: ''
};

kickOffApp(token, myAppInfo);

// Initialize the SDK for this user
// Get all the rooms' read states
// Do some analysis on them and then 
// start listening for new read receipts
async function kickOffApp(token, myAppInfo) {
  let teams = await webexSdk.init({
    credentials: {
      access_token: token
    }
  });
  if (!teams) {
    console.error('Failed to initialize SDK, bailing!');
    process.exit();
  }
  myAppInfo.teams = teams;
  teams.people.get('me').then((me) => {
    myAppInfo.myPersonId = me.id;
  }).catch(e => {
    console.error('Cannot get user details.  Bye!');
    process.exit();
  });


  // First call to get the current state of the users rooms
  let readInfo = new ReadInfo(token);
  readInfo.getReadStatus().then(roomStates => {
    if ((!roomStates.items) || (!roomStates.items.length)) {
      console.error('No rooms for this user.  Exiting.');
      process.exit();
    } else {
      console.log('User is a member of %d spaces.  Calculating read states...', 
        roomStates.items.length);
    }

    // Print out some state about the current roomStates
    let unReadCount = 0;
    let firstUnread = '';
    let readCount = 0;
    let firstRead = '';
    for (let index in roomStates.items) {
      let roomState = roomStates.items[index];
      if (moment(roomState.lastActivityDate,moment.ISO_8601).valueOf() >
        moment(roomState.lastSeenDate,moment.ISO_8601).valueOf()) 
      {
        unReadCount += 1;
        if (!firstUnread) {
          firstUnread = roomState.roomId;
          teams.rooms.get(firstUnread).then(room => {
            console.log('First unread room title: "'+room.title+'"');

          }).catch(e => console.log('Failed to get first unread room title: '+e.message));
        }
      } else {
        readCount += 1;
        if (!firstRead) {
          firstRead = roomState.roomId;
          teams.rooms.get(firstRead).then(room => {
            console.log('First Read room title: "'+room.title+'"');

          }).catch(e => console.log('Failed to get first Read room title: '+e.message));
        }
      }
    }
    // Print out some stats
    console.log(`User has ${unReadCount} unread spaces.`);
    console.log(`User has ${readCount} read spaces.`);
    myAppInfo.roomStates = roomStates.items;

    // Initalize the eventPump and readInfo modules
    new EventPump(teams, 
      processMessageEvent, 
      processMembershipEvent,
      processRoomEvent);

    // Loop until we get a forced restart
    waitForKill();

  }).catch(e => console.error('Cannot read room states: '+e.message));

}

// When new messages come in check if we need to put rooms in the unread state
function processMessageEvent(e, message) {
  if (e) {
    console.error('Got an error while processing events: '+e.message);
  }

  // Check if this is a new message
  if ((message) && (message.lastActivity) && (message.lastActivity == 'created')) {
    let index = myAppInfo.roomStates.findIndex(room => room.roomId === message.roomId);
    if (index >= 0) {
      // Lookup the room title for friendlier console output
      myAppInfo.teams.rooms.get(message.roomId).then(room => {
        // Check what the GUI should do with this message
        if (message.personId === myAppInfo.myPersonId) {
          console.log('Got a notice of a message we sent.  GUI should add the text to the space window!');
        } else {
          console.log('Got a message that someone else sent.  If "'+room.title+
            '" is not the space our user is currently looking at we should update the GUI to show that this room is unread.');
        }
      }).catch(e => {
        console.error('Error looking up title for room that got a read activity: '+e.message);
      });
      // Update our roomState last Activity Date
      myAppInfo.roomStates[index].lastActivityDate = message.lastActivityDate;
      // If this is our own read message, update our lastSeendDate
      if (message.personId === myAppInfo.myPersonId) {
        myAppInfo.roomStates[index].lastSeenDate = message.lastActivityDate;
      }
    } else {
      console.log('Do not have room state for roomId: '+ message.roomId);
      console.log('This can happen if the space was created after this app started.');  
    }
  } else {
    console.error('Unable to process message event!');
  }
}

// If we get a membership update event use it to
// update our membership state
function processMembershipEvent(e, membership) {
  if (e) {
    console.log('Got an error while processing events: '+e.message);
    return;
  } 

  // If this is a read receipt update our room state info
  if ((membership) && (membership.lastActivity) && (membership.lastActivity == 'updated')) {
    let index = myAppInfo.roomStates.findIndex(room => room.roomId === membership.roomId);
    if (index >= 0) {
      // Lookup the room title for friendlier console output
      myAppInfo.teams.rooms.get(membership.roomId).then(room => {
        // Update the read state that we are keeping in memory
        let roomState = myAppInfo.roomStates[index];
        if (moment(roomState.lastActivityDate,moment.ISO_8601).valueOf() >
          moment(roomState.lastSeenDate,moment.ISO_8601).valueOf()) {
          if (membership.personId === myAppInfo.myPersonId) {
            console.log('Got our own read reciept for an unread room.  GUI should change status!');
          } else {
            console.log('Someone else has caught up in one of our unread rooms. No need for GUI change');
          }
        } else {
          console.log('If the user is not actively looking at it, a GUI based app should '+
          'move the room with title: "'+room.title+'" to the unread state');
        }
      }).catch(e => {
        console.error('Error looking up title for room that got a read activity: '+e.message);
      });
      // Update our roomState last Activity Date
      myAppInfo.roomStates[index].lastActivityDate = membership.lastActivityDate;
      // If this is our own read receipt, update our lastSeendDate
      if (membership.personId === myAppInfo.myPersonId) {
        myAppInfo.roomStates[index].lastSeenDate = membership.lastActivityDate;
      }
    } else {
      console.log('Do not have room state for roomId: '+ membership.roomId);
      console.log('This can happen if the space was created after this app started.');  
    }
  } else {
    console.error('Unable to process message event!');
  }
}

// When a new room is created, add it to our internal list of room states
function processRoomEvent(e, room) {
  if (e) {
    console.log('Got an error while processing events: '+e.message);
    return;
  }
  if ((room) && (room.lastActivity) && (room.lastActivity == 'created')) {
    // Lookup the room title for friendlier console output
    myAppInfo.teams.rooms.get(room.id).then(newRoom => {
      console.log('A new room: "'+newRoom.title+'" was created.  Adding it to our internal state.');
    }).catch(e => {
      console.error('Error looking up title for room that got a read activity: '+e.message);
    });
    let newRoomState = {
      roomId: room.id,
      lastActivityDate: room.lastActivityDate
    };
    if (room.creatorId === myAppInfo.myPersonId) {
      // we created this room so it is in the "read" state
      newRoomState.lastSeenDate = room.lastActivityDate;
    } else {
      // we have never seen this room before
      newRoomState.lastSeenDate = new Date(0).toISOString();
    }
    myAppInfo.roomStates = myAppInfo.roomStates.concat(newRoomState);
  } else {
    console.error('Unable to process room event!');
  }
}


// loop until the user hits ctrl=-c
function waitForKill(){
  setTimeout(function(){
    console.log('Waiting for events.  CTRL-C to exit...');
    waitForKill();
  }, 60000);
}



