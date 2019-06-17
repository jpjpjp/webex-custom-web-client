// Chat.js
// This is the main class for our webex powered chat app
// It currently includes all the logic for interacting
// with webex
// An ideal implementation would probably encapsulate this better...

import React from 'react';
import Users from "./Users";
import Messages from "./Messages";
import EnterChat from "./EnterChat";
// The Webex JS SDK was renamed from "ciscospark" to "webex"
import { init as initTeams } from 'webex';

// Create the object for generating client side events
// NEW API
var EventPump = require('webex-js-eventpump');
// Create an object for sending read receipts and getting
// information on read status when loading a new room
// NEW API
var ReadInfo = require('webex-read-info');

// This class implements the main chat GUI and interfaces with webex
class Chat extends React.Component {

  constructor(props) {
    super(props);

    // These elements are used in both modes
    this.state = {
      // GUI Elements
      username: '',  
      chat_ready: false,
      lookingState: 'looking',  // Used for new activity marker, can also be 'away', or 'back'
      newMessagesIndex: -1,     // Index in message array where New Messages notification is
      users: [],                // For membership display
      usersById: [],            // Shortcut to get user name from membership.personId
      lastReadById: [],         // Keep track of the last read message by user
      messages: [],             // Local copy of messages
      lastMsgId: '',            // ID of the last message sent

      // These elements are used to leverage a Webex Teams backed chat session
      teams: null,              // Teams SDK will go here
      user: null,               // The Teams User object
      roomId: ''                // Webex Teams Space that will power this chat
    }

    // Uncomment to skip login during debugging
    // this.setUserKey({
    //     roomId: "RoomID you want to use for debugging",
    //     token: "Token for user you will use for debugging"
    // });

  }


  /**
   * Once a user has "logged in" by choosing one of a preset list of webex user
   * register that user with the Webex SDK and load the predefined space to start in
   * 
   * For demo purposes we use a canned set of users and their dev tokens
   * A real app would have a proper login and auth flow
   * 
   * We also "pre-select" the starting room.  As this app matures it may 
   * implement a list of rooms and let the user select
   *
   * @function setUserKey
   * @param {object} userInfo - object with token and roomId for the user
   */
  setUserKey(userInfo) {
    let token = userInfo.token;
    let roomId = userInfo.roomId;
    if (token) {
      // Initialize the SDK for this user
      let teams = (window.webexteams = initTeams({
        credentials: {
          access_token: token
        }
      }));

      if ((teams) && (teams.canAuthorize)) {
        // We use the new webex SDK events feature to 
        // register for message, membership and room events
        // This replaces the functionality previously provided
        // by the eventPump "shim"
        teams.messages.listen()
        .then(() => {
          console.log('listening to message events');
          teams.messages.on('created', async (message) => {
            console.log('message created event:');
            console.log(message);
            await this.messageCreated(message.data);
            this.scrollToBottom();
          });
          teams.messages.on('deleted', (message) => {
            console.log('message deleted event:');
            console.log(message);
            this.messageDeleted(message.data);
          });
        })
        .catch((err) => {
          console.error(`error listening to messages: ${err}`);
          alert('Couldnt initialize user! (Check the console)');
        });
        teams.memberships.listen()
        .then(() => {
          console.log('listening to membership events');
          teams.memberships.on('created', (membership) => {
            console.log('membership created event');
            console.log(membership);
            this.membershipCreated(membership.data);
          });
          teams.memberships.on('deleted', (membership) => {
            console.log('membership deleted event');
            console.log(membership);
            this.membershipDeleted(membership.data);
          });
          teams.memberships.on('seen', (membership) => {
            console.log('membership seen (read receipt) event');
            console.log(membership);
            this.readReceipt(membership.data);
          });
          teams.memberships.on('updated', () => {
            console.log('Igoring membership:updated event.  This is usually a change in moderator status.');
          });
        })
        .catch((err) => {
          console.error(`error listening to memberships: ${err}`);
          alert('Couldnt initialize user! (Check the console)');
        });
      // Register for room events
      teams.rooms.listen()
        .then(() => {
          console.log('listening to room events');
          teams.rooms.on('updated', () => {
            console.log('Ignoring a room updated event.  This usually means the room title changed.');
          });
        })
        .catch((err) => {
          console.error(`error listening to rooms: ${err}`);
          updateStatus(false);
        });


        let username = '';
        let user = null;
        // Get the webex person details for this user
        teams.people.get('me').then((userObj) => {
          user = userObj;
          user.displayName ? username = user.displayName : username = user.firstName + ' '+ user.lasName;
          return this.setState({
            user: user,
            username: username,
            teams: teams
          });
        }).then(() => {
          // Our user is set up.  Lets set up the initial space for the chat
          return this.setUpSpace(roomId);
        }).catch((e) => {
          console.error(e.message);
          alert('Couldnt initialize user! (Check the console)');
        });
      } else {
        alert('Couldnt initialize webex for user with token supplied');
      }
    } else {
      alert('Couldnt initialize user, no token supplied');
    }
  }

  /**
   * Configure a new space
   * 
   * Currently our GUI only supports one space, but this method can be called
   * in a more robust GUI that supports switching spaces for the same user
   * register that user with the Webex SDK and load the predefined space to start in
   *
   * @function setUpSpace
   * @param {string} roomId - ID of the space we want the user to chat in
   */
  setUpSpace(roomId) {
    // Init variables we'll set up here
    let users = [];     
    let usersById = [];  // convenience for space member name display
    let messages = [];
    let lastMsgId = '';
    let lastReadById = []  // maintain last read state per space member
    

    // NEW API call here
    // The memberships.listWithReadStatus provides similar functionality
    // to what we got with the readInfo "shim".   We call it here to
    // Get the membership of the space along with their read status 
    return this.state.teams.memberships.listWithReadStatus({roomId})
    .then((memberships) => {
      // Keep a local cache of members for display purposes
      for (const member of memberships.items) {
        // Message events have the sender ID but not name
        // Map ID to Name locally to avoid multiple SDK queries
        usersById[member.personId] = member.personDisplayName;
        users = users.concat([member.personDisplayName]);
        lastReadById[member.personId] = member.lastSeenId ? member.lastSeenId : '';
      }
      // Now lets get the messages
      return this.state.teams.messages.list({
        roomId: roomId,
        max: 20
      });
    }).then((messageList) => {
      // Put the messages in our local store from oldest to newest
      for (let i=messageList.items.length-1; i>=0; i--) {
        let msg = messageList.items[i]; 
        // Store the username and the message text locally for fast rendering
        // TODO, what is type for and why the hierarcy?
        messages =messages.concat([{
          username: usersById[msg.personId] ? usersById[msg.personId] : 'User Who Left',   
              // better would be to check for this case and query the id via people.get()
          message: {
            type: 'message',
            text: msg.html ? msg.html : msg.text
          }
        }]);
      }
      // We will check the last message id when we
      // process or generate read receipts  
      lastMsgId = messageList.items.length ? messageList.items[0].id : '';

      // If our user has an older last read we should generate a read receipt
      // since we are seeing up to the latest now...
      if ((lastMsgId) && (lastReadById[this.state.user.id] != lastMsgId)) {
        lastReadById[this.state.user.id] = lastMsgId;
        // NEW API
        // memberships.updateLastSeen replaces the readnInfo.sendReadReceipt
        // functionality, we no longer pass in a user ID since we can only SET
        // read receipts for "our own" user
        this.state.teams.memberships.updateLastSeen({
          roomId,
          id: lastMsgId
        });
      }
      // OK, we have everything we need to display the space, force a render
      return this.setState({
        users: users,
        usersById: usersById,
        messages: messages,
        lastMsgId: lastMsgId,
        lastReadById: lastReadById,
        roomId: roomId,
      });
    })
    .then(() => this.initChat())
    .then(() => this.scrollToBottom())
    .catch((e) => {
      console.error(e.message);
      alert('Couldnt initialize space!  (Check console)');
    });
  }

/**
   * After we have set up for a user, move to "chat mode"
   * This means changing the render from login mode to chat
   *
   * @function initChat
   */
  initChat() {
    this.setState({
      chat_ready: true,   // changes render from login mode to chat mode
    });
  }

  // TODO -- see if these can be distributed more efficiently
  // ie: membership related functions in the Users class
  // message functions in the Messages class, etc

 /**
   * Process a message that was typed in by our user
   *
   * @function sendMessage
   * @param {string} message - message text
   */
  sendMessage(message) {
    console.log(message);
    // TODO encapsulate this in the read reciept logic better
    if (this.state.lookingState === 'back') {
      // This is the first new message sent since coming back
      // remove the New Messages notification if we have one
      this.removeNewMessageIndicator()
    }

  // Send the "normal"message to webex for distribution
    this.state.teams.messages.create({
      roomId: this.state.roomId,
      text: message.text
    }).catch((e) => {
      console.error(e.message);
      alert('Error sending message to webex!  (Check console)');
    });
  }

 /**
   * Send a selected file as a message attachment
   *
   * @function sendFile
   * @param {object} fileInfo - file info returned from an html input type=file
   */
  sendFile(fileInfo) {
    // Show what the html <input type=file> form returned
    console.log('Web form provided a file:');
    console.log(fileInfo);
    // Pass the file object to the SDK
    this.state.teams.messages.create({
      roomId: this.state.roomId,
      // "text" or "markdown" could also be supplied here
      files: [fileInfo]
    }).then(msg => {
      console.log('SDK sent the message with file attachment:');
      console.log(msg);
    }).catch((e) => {
      console.error(e.message);
      alert('Error sending message to webex!  (Check console)');
    });
  }
/**
 * Process an incoming new message event
 * NEW API
 *
 * @function messageCreated
 * @param {object} msg - newly created message object
 */
  messageCreated(msg) {
    try {
      if (msg.roomId != this.state.roomId) {
        //TODO
        console.log(
          'Ignoring message event for a room other than the current one.\n'+
          'This type of event could be used to mark spaces as having new unread messages.'
        );
        return;
      }
      // Update this spaces view
      this.setState((prevState) => {
        // Add new msg to the list
        let newState = ({
          messages: prevState.messages.concat([{
            username: prevState.usersById[msg.personId],
            message: {
              type: 'message',
              text: msg.html ? msg.html : msg.text
              // TODO Files?
              }
            }]),
          lastMsgId: msg.id,
          lastReadById: prevState.lastReadById
        });
        // Updated read statuses as needed
        if (prevState.lookingState == 'looking') {
          // If we are looking lets mark this message as read
          newState.lastReadById[prevState.user.id] = msg.id;
          this.state.teams.memberships.updateLastSeen(msg);
        }
        // We also mark the sender as caught up in our internal cache
        newState.lastReadById[msg.personId] = msg.id;
        return newState;
      });
    } catch (e) {
      alert('Error processing new message: '+e.message);
    }
  }

/**
 * Process a message that was deleted
 * Not all custom clients will support this
 * NEW API
 *
 * @function messageDeleted
 * @param {object} message - message object
 */
  messageDeleted(message) {
    // TODO
    alert('A messages was deleted by '+this.state.usersById[message.personId]+
      '\nHave not implemented client side GUI to deal with this');
  }

/**
  * A new user is in the space update our user store
  * NEW API
  * @function membershipCreated
  * @param {object} membership - membership object with lastActivity == created
  */
  membershipCreated(membership) {
    try {
      if (membership.roomId != this.state.roomId) {
        // TODO
        console.log(
          'Ignoring membership event for a room other than the current one.\n'+
          'This type of event could be used to mark spaces as having new activity.'
        );
        return;
      }
      // Update the membership list
      this.state.usersById[membership.personId] = membership.personDisplayName;
      this.state.lastReadById[membership.personId] = '';
      this.setState({
          users: this.state.users.concat(membership.personDisplayName),
          usersById: this.state.usersById,
          lastReadById: this.state.lastReadById
      });
    } catch(e) {
      alert('Got notified of a new membership, but cannot get it: '+e.message);
    }
  }

/**
  * A user was removed from the space update our user store
  * NEW API
  *
  * @function membershipDeleted
  * @param {object} membership - membership object with lastActivity == deleted
  */
  membershipDeleted(membership) {
    try {
      if (membership.roomId != this.state.roomId) {
        console.log(
          'Ignoring membership deleted event for a room other than the current one.\n'+
          'This type of event could be used to update the list of spaces the user is in.'
        );
        return;
      }
      // We don't handle our own membership being deleted, just put up an alert
      if (membership.personId === this.state.user.id) {
        alert('Our user was removed from this space!  We don\'t handle this well!\n' +
              'See if the user can be added back or unexpected errors may occur.');
        //TODO do something better than this...
        return;
      }
      // Update the membership list and membership info
      if (membership.personId in this.state.usersById) delete this.state.usersById[membership.personId];
      if (membership.personId in this.state.lastReadById) delete this.state.lastReadById[membership.personId];
      let index = this.state.users.indexOf(membership.personDisplayName);
      if (index !== -1) this.state.users.splice(index, 1);
      this.setState({
          users: this.state.users,
          usersById: this.state.usersById
      });
    } catch(e) {
      alert('Got notified of a deleted membership, but could not it: '+e.message);
    }
  }

/**
  * A user has read messages
  * NEW API
  *
  * @function readReceipt
  * @param {object} membership - membership with lastActivity == read
  */
 readReceipt(membership) {
  try {
    if (membership.roomId != this.state.roomId) {
      console.log(
        'Ignoring readReceipt event for a room other than the current one.\n'+
        'If the client is caching this type of info it could do something with this.'
      );
      return;
    }
    if (!membership.lastSeenId) {
      alert('Got a membership event with lastActivity read, but not messageId');
      return;
    }
    // If this is our own read receipt there is nothing to do.
    if (membership.personId !== this.state.user.id) {
      // Update Read Receipt list if this is for the last message in our list
      if (membership.lastSeenId === this.state.lastMsgId) {
        this.state.lastReadById[membership.personId] = membership.lastSeenId;
        this.setState({lastReadById: this.state.lastReadById})
        // if read receipt arrived after membership was deleted
      } else {
        console.log('Ignoring read receipt from %s, as its not for the last message',
          this.state.usersById[membership.personId]);
      }
    } else {
      console.log('Ignoring our own read receipt event...')
    }
  } catch(e) {
    alert('Got notified of a read receipt, but could not process it: '+e.message);
  }
}

// The following methods implement an extremely crude
// logic for rendering a "New Messages" GUI
// Since this sample only has one space "new messages"
// will only happen if the user hits the "I'm not looking" button

  // React to a "Stop Looking" action
  goneAway(e) {
    console.log('User is not looking');
    if (this.state.lookingState == 'away') {
      console.log('Already in not looking state');
      return;
    }
    // If the user took this action we assume all existing
    // messages are read.
    // Get rid of any previous New Message indicators
    this.removeNewMessageIndicator()
    // Set the looking state to away and add a special
    // marker in the queue to indicate where our 
    // New Messages notification should go
    let newMessagesIndex = this.state.messages.length;
    this.setState({
      lookingState: 'away',
      newMessagesIndex: newMessagesIndex,
      messages: this.state.messages.concat([{
        username: localStorage.getItem('username'),
        uid: localStorage.getItem('uid'),
        message: {
          type: 'goneAwayMarker',
          text: 'New Message Marker'
        }
      }])
    });
  }

  // React to a "Start Looking" action
  async isBack(e) {
    console.log('user is back');
    if (this.state.lookingState == 'looking') {
      console.log('Already in is looking state');
      return;
    }
    // Don't show New Messages attribute if none arrived
    // while we weren't looking
    if (this.state.newMessagesIndex === this.state.messages.length - 1) {
      this.state.messages.pop();
      this.setState({
        newMessagesIndex: -1,
        messages: this.state.messages
      });
    }
    // Set the looking state to back
    // In this state we will show the new messages marker
    // if any messages came in while we were away
    await this.setState({ lookingState: 'back' });
    this.scrollToBottom();

    // Notify other clients that we are caught up
    // unless no new messages have arrived since we left
    if (this.state.lastReadById[this.state.user.id] != 
        this.state.lastMsgId) 
    {
      // NEW API
      this.state.teams.memberships.updateLastSeen({
        roomId: this.state.roomId,
        id: this.state.lastMsgId,
      });      
    }
  }

  // Takes the new message marker out of the queue
  removeNewMessageIndicator(e) {
    if ((this.state.newMessagesIndex > -1) &&
      (this.state.newMessagesIndex < this.state.messages.length)) 
    {
      this.state.lastReadById[this.state.user.id] =  this.state.lastMsgId;
      this.state.messages.splice(this.state.newMessagesIndex, 1);
      this.setState({
        lookingState: 'looking',
        newMessagesIndex: -1,
        lastReadById: this.state.lastReadById
      });
    }
  }


  scrollToBottom() {
    let messages = document.getElementsByClassName('messages')[0];
    messages.scrollTop = messages.scrollHeight - messages.clientHeight;
  }

  
  render() {
    return (
      <div className="chat">
        {this.state.chat_ready ? (
          <React.Fragment>
            <Users users={this.state.users}
              usersById={this.state.usersById} 
              lastReadById={this.state.lastReadById} 
              lastMsgId={this.state.lastMsgId} 
            />
            <Messages
              sendMessage={this.sendMessage.bind(this)}
              goneAway={this.goneAway.bind(this)}
              isBack={this.isBack.bind(this)}
              messages={this.state.messages}
              lookingState={this.state.lookingState}
            />
            <input id="file-attachment" type="file" 
              onInput={(event)=> {this.sendFile(event.target.files[0]).bind(this)}}
            />
          </React.Fragment>
        ) : (
            <EnterChat
              setUserKey={this.setUserKey.bind(this)}
            />
          )}
      </div>
    )
  }
}

export default Chat;