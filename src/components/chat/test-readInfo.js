// test-readInfo.js
// node app to demonstrate the use of the 
// readInfo and eventPump modules

//import { init as initTeams } from 'ciscospark';
var webexSdk = require('ciscospark');
var EventPump = require('./eventPump.js');
var ReadInfo = require('./readInfo.js');
var moment = require('moment');

// Read token from env (or command line?)
let token = 'MjI4YTgwZjAtZGQ1MS00MTRjLWIxNDEtZTdkZDkyMTdkZjFhMWM1MjZiMmUtNTI5';
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
            console.log('First unread room title: '+room.title);

          }).catch(e => console.log('Failed to get first unread room title: '+e.message));
        }
      } else {
        readCount += 1;
        if (!firstRead) {
          firstRead = roomState.roomId;
          teams.rooms.get(firstRead).then(room => {
            console.log('First Read room title: '+room.title);

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
      processMembershipEvent);

    // Loop until we get a forced restart
    waitForKill();

  }).catch(e => console.error('Cannot read room states: '+e.message));

}

// Lets ignore message events (but not get warnings from eventPump)
function processMessageEvent() {
  // NO OP -- ignore event
}

// If we get a membership update event use it to
// update our membership state
function processMembershipEvent(e, membership) {
  // If this is a read receipt update our room state info
  if ((membership) && (membership.lastActivity) && (membership.lastActivity == 'updated')) {
    let index = myAppInfo.roomStates.findIndex(room => room.roomId === membership.roomId);
    if (index >= 0) {
      // Update the read state that we are keeping in memory
      // A GUI based app might indicate that this room has moved into the "unread" state
      // if the user is not actively viewing it
      let roomState = myAppInfo.roomStates[index];
      if (moment(roomState.lastActivityDate,moment.ISO_8601).valueOf() >
        moment(roomState.lastSeenDate,moment.ISO_8601).valueOf()) {
        console.log('Got an read reciept for a room that is already unread');
      } else {
        myAppInfo.teams.rooms.get(membership.roomId).then(room => {
          console.log('If the user is not actively looking at it, a GUI based app should '+
          'move the room with title: '+room.title+' to the unread state');
        }).catch(e => {
          console.error('Error looking up title for room that got a read activity: '+e.message);
        });
      }
      // Update our roomState last Activity Date
      myAppInfo.roomStates[index].lastActivityDate = membership.lastActivityDate;
      // If this is our own read receipt, update our lastSeendDate
      if (membership.personId === myAppInfo.myPersonId) {
        myAppInfo.roomStates[index].lastSeenDate = membership.lastActivityDate;
      }
    }
  } else {
    console.log('Do not have room state for roomId: '+ membership.roomId);
    console.log('This can happen if the space was created after this app started.');
  }
}


// loop until the user hits ctrl=-c
function waitForKill(){
  setTimeout(function(){
    console.log('Waiting for events.  CTRL-C to exit...');
    waitForKill();
  }, 60000);
}



