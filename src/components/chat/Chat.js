import React from 'react';
import Users from "./Users";
import Messages from "./Messages";
import EnterChat from "./EnterChat";
import socketIOClient from 'socket.io-client';
import { init as initTeams } from 'ciscospark';
import { AssertionError } from 'assert';

// Create the object for generating client side events
var EventPump = require('./eventPump.js');
// Create an object for sending and getting read receipts
var ReadInfo = require('./readInfo.js');


// This class implements the main chat GUI and interfaces with webex
class Chat extends React.Component {

  constructor(props) {
    super(props);

    // Toggle between internal socket and webhook server modes
    let internalSocket = true;

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

    if (internalSocket) {
      this.state.internalSocket = true;  // SDK events generates callbacks
      this.state.eventPump = {}         // generate events from internal SDK interfaces  
      this.state.readInfo = {}          // talk to internal interfaces for read receipts
    } else {
      this.state.internalSocket = true;  // webhook server generates callbacks
      this.socket = null;       
      this.state.uid = localStorage.getItem('uid') ? localStorage.getItem('uid') : this.generateUID();
    }

    // hacks to test the SDK, this would normaly be in permanent storage
    // Associate user names with their token
    localStorage.setItem('jpbulk', 'MjI4YTgwZjAtZGQ1MS00MTRjLWIxNDEtZTdkZDkyMTdkZjFhMWM1MjZiMmUtNTI5')
    // Assoicate users to the rooms they belong in
    // TODO? handle logic to create rooms if none exist
    localStorage.setItem('Y2lzY29zcGFyazovL3VzL1BFT1BMRS82YWE2ZGE5OS0xYzdlLTQ4MWItODY3YS03MWY2NTIwNDk0MzM', 'Y2lzY29zcGFyazovL3VzL1JPT00vYjU0ZDJlMjAtM2VmMy0xMWU5LWJlYzQtYjE3MjI3YTI4YTBi');

  }

  // I think I can comment this out and force a "login" every time
  // Hack to skip login during debugging

  componentDidMount() {
    this.setUserKey({
      roomId: "Y2lzY29zcGFyazovL3VzL1JPT00vODE5MDMwZjAtNDA1MS0xMWU5LTkxMWUtZjE3YzMyNTVjZTlh",
      token: "ZWNiN2YxZDYtMGZhNS00M2VkLThmMWUtNmE5OGYyMTA4Y2Q4OTlkOTM5NjItNjVm_PF84_ce861fba-6e2f-49f9-9a84-b354008fac9e"
    });
  }

  // Its not clear we need this UUID thing when webex powers our chat
  // generateUID() {
  //   let text = '';
  //   let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  //   for (let i = 0; i < 15; i++) {
  //     text += possible.charAt(Math.floor(Math.random() * possible.length));
  //   }
  //   localStorage.setItem('uid', text);
  //   return text;
  // }

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
    let roomId = userInfo.roomId
    if (token) {
      // Initialize the SDK for this user
      let teams = (window.webexteams = initTeams({
        credentials: {
          access_token: token
        }
      }));

      if (teams) {
        // Initialize our event pump with the methods to call for each event type
        // TODO consider if this should happen AFTER we query
        // for the room membership and message details
        // A real app must consider that events that occur while 
        // we are doing the initial webex space setup may show up twice:
        // once in our event queue, and again when we poll for space info
        let eventPump = {};
        if (this.state.internalSocket) {
          eventPump = new EventPump(teams, 
            this.processMessageEvent.bind(this),
            this.processMembershipEvent.bind(this));
        }

        let readInfo = new ReadInfo(token);

        let username = '';
        let user = null;
        let users = [];
        let usersById = [];
        let messages = [];
        let lastReadById = [];
        let lastMsgId = '';
        // Get the webex person details for this user
        teams.people.get('me').then((userObj) => {
          user = userObj;
          user.displayName ? username = user.displayName : username = user.firstName + ' '+ user.lasName;

          // Now lets get the space membership info
          return teams.memberships.list({roomId: roomId});
        }).then((memberships) => {
          // Keep a local cache of members for display purposes
          for (let i=0; i<memberships.items.length; i++) {
            let member = memberships.items[i]; 
            // Message events have the sender ID but not name
            // Map ID to Name locally to avoid multiple SDK queries
            usersById[member.personId] = member.personDisplayName;
            users = users.concat([member.personDisplayName]);
          }
          // Now lets get the messages
          return teams.messages.list({
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
              username: usersById[msg.personId],    
                  // This will not work if the author has left the space, 
                  // better would be to check for that case and query the id via /people
              //uid: 12345,         // Maybe don't need this anymore?
              message: {
                type: 'message',
                text: msg.html ? msg.html : msg.text
              }
            }]);
          }
          // We will check the last message id when we
          // process or generate read receipts  
          lastMsgId = messageList.items[0].id;

          // We keep track of the last read message by each user
          // TODO figure out how to query this from conversataions for other users
          // If our user has an older last read we should generate a read receipt here
          lastReadById[user.id] = lastMsgId;

          
          // OK, we have everything we need to display the space, force a render
          return this.setState({
            eventPump: eventPump,
            readInfo: readInfo,
            user: user,
            username: username,
            users: users,
            usersById: usersById,
            messages: messages,
            lastReadById: lastReadById,
            lastMsgId: lastMsgId,
            roomId: roomId,
            teams: teams
          });
        }).then(() => this.initChat())
        .catch((error) => {
          console.error(error);
        });
      } else {
        alert('Couldnt initialize for '+username);
      }
    } else {
      alert('Couldnt find Webex info for '+username);
    }
  }

/**
   * After we have set up for a user, move to "chat mode"
   * This means changing the render from login mode to chat
   * If working with a seperate server, open socket connections
   *
   * @function initChat
   */
  initChat() {
    // Not sure if I need this...
    //localStorage.setItem('username', this.state.username);
    this.setState({
      chat_ready: true,   // changes render from login mode to chat mode
    });

    if (!this.state.internalSocket) {
      // Set up a socket with the server
      // I'll use this to get notified of new messages
      // and (possibly) to notify other clients of read activities
      this.socket = socketIOClient('ws://localhost:8989', {
        query: 'username=' + this.state.username + '&uid=' + this.state.uid
      });

      this.socket.on('updateUsersList', function (users) {
        console.log(users);
        this.setState({
          users: users
        });
      }.bind(this));

      this.socket.on('message', function (message) {
        this.setState({
          messages: this.state.messages.concat([message])
        });
        this.scrollToBottom();
      }.bind(this));
    }
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
  sendMessage(message, ) {
    console.log(message);
    // TODO encapsulate this in the read reciept logic better
    if (this.state.lookingState === 'back') {
      // This is the first new message since coming back
      // remove the New Messages notification if we have one
      this.removeNewMessageIndicator()
    }
    if (this.state.teams) {
      // Lets send the message via teams if configured
      let roomId = this.state.roomId;
      this.state.teams.messages.create({
        roomId,
        text: message.text
      });
    } 

    this.scrollToBottom();
  }

processMessageEvent(message) {
  try {
    switch(message.lastActivity) {
      case('created'):
        this.messageCreated(message.id, message.roomId);
        break
      case('deleted'):
        this.messageDeleted(message);
        break
      default:
        alert('Got unexpected message event activity: '+message.lastActivity);
    }

  } catch(e) {
    alert('Got notified of a message event, but cannot get it: '+e.message);
  };
}

processMembershipEvent(membership) {
  try {
    switch(membership.lastActivity) {
      case('created'):
        this.membershipCreated(membership);
        break
      case('deleted'):
        this.membershipDeleted(membership);
        break
      case('read'):
        this.readReceipt(membership);
        break
      default:
        alert('Got unexpected membership event activity: '+membership.lastActivity);
    }

  } catch(e) {
    alert('Got notified of a membership event, but cannot get it: '+e.message);
  };
}



/**
 * Process a message that was created by any user in our spaces
 *
 * @function messageCreated
 * @param {string} msgId - id of new message
 * @param {string} roomId - id of the space the message is in 
 */
  messageCreated(msgId, roomId) {
    if (roomId != this.state.roomId) {
      //TODO
      console.log(
        'Ignoring message event for a room other than the current one.\n'+
        'This type of event could be used to mark spaces as having new unread messages.'
      );
      return;
    }
    // Get the message contents and update our local message store
    this.state.teams.messages.get(msgId).then((msg) => {
      // If we are looking lets mark this message as read
      if (this.state.lookingState == 'looking') {
        this.state.lastReadById[this.state.user.id] = msg.id;
      }
      // We also mark the sender as read
      this.state.lastReadById[msg.personId] = msg.id;
      return this.setState({
        messages: this.state.messages.concat([{
          username: this.state.usersById[msg.personId],
          //uid: 12345,  // Need to figure out if I still need this
          message: {
            type: 'message',
            text: msg.html ? msg.html : msg.text
          },
        }]),
        lastMsgId: msg.id,
        lastReadById: this.state.lastReadById
      });
    }).then(() => this.scrollToBottom())
    .catch((e) => {
      alert('Got notified of a new message, but cannot get it: '+e.message);
    });
  }

/**
 * Process a message that was deleted
 * Not all custom clients will support this
 *
 * @function messageDeleted
 * @param {object} message - message object
 */
  messageDeleted(message) {
    // TODO
    alert('A messages was delete by '+this.state.usersById[message.personId]+
      '\nHave not implemented client side GUI to deal with this');
  }

/**
  * A new user is in the space update our user store
  *
  * @function membershipCreated
  * @param {object} membership - membership object 
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
  *
  * @function membershipDeleted
  * @param {object} membership - membership object 
  */
  membershipDeleted(membership) {
    try {
      if (membership.roomId != this.state.roomId) {
        console.log(
          'Ignoring membership deleted event for a room other than the current one.\n'+
          'If the server is caching this type of info it could.'
        );
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
    if (!membership.lastReadId) {
      alert('Got a membership event with lastActivity read, but not messageId');
      return;
    }
    // If this is our own read receipt there is nothing to do.
    if (membership.personId !== this.state.user.id) {
      // Update Read Receipt list if this is for the last message in our list
      if (membership.lastReadId === this.state.lastMsgId) {
        this.state.lastReadById[membership.personId] = membership.lastReadId;
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

// The following methods implement and  extremely crude
  // logic for read receipts in our client

  // React to a "Im not looking" action
  goneAway(e) {
    console.log('User is not looking');
    if (this.state.lookingState == 'away') {
      // Shouldn't happen?
      console.log('Already in not looking state');
      return;
    }
    // Get rid of any previous New Message indicators
    this.removeNewMessageIndicator()
    // Set the looking state to away and add a special
    // Message in the queue to indicate where our 
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
    // Todo Add a new socket event to notify other clients
    // this.socket.emit('message', {
    //   username: localStorage.getItem('username'),
    //   uid: localStorage.getItem('uid'),
    //   message: message,
    // });
    this.scrollToBottom();
  }

  // React to a "Im back" action
  isBack(e) {
    console.log('user is back');
    if (this.state.lookingState == 'looking') {
      // Shouldn't happen?
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
    this.setState({ lookingState: 'back' });

    // Notify other clients that we are caught up
    // unless no new messages have arrived since we left
    if (this.state.lastReadById[this.state.user.id] != 
        this.state.lastMsgId) 
    {
      this.state.readInfo.sendReadReciept(
        this.state.user.id,
        this.state.lastMsgId,
        this.state.roomId
      );
    }
    // Todo Add a new socket event to notify other clients
    // this.socket.emit('message', {
    //   username: localStorage.getItem('username'),
    //   uid: localStorage.getItem('uid'),
    //   message: message,
    // });
    this.scrollToBottom();
  }

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
            {/* <Users users={this.state.users} />
            <ReadBy 
              usersById={this.state.usersById} 
              lastReadById={this.state.lastReadById} 
              lastMsgId={this.state.lastMsgId} 
            /> */}
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