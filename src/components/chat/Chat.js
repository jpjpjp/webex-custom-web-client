import React from 'react';
import Users from "./Users";
import Messages from "./Messages";
import EnterChat from "./EnterChat";
import socketIOClient from 'socket.io-client';
import { init as initTeams } from 'ciscospark';
import { AssertionError } from 'assert';

// Create the object for processing Events
var EventPump = require('./eventPump.js');


class Chat extends React.Component {

  constructor(props) {
    super(props);
    this.socket = null;
    this.state = {
      internalSocket: true,  // toggle between modes
      eventPump: null,       // is used to get events from internal SDK interfaces
//      username: localStorage.getItem('username') ? localStorage.getItem('username') : '',
      username: '',  // force login every page refresh
      uid: localStorage.getItem('uid') ? localStorage.getItem('uid') : this.generateUID(),
      chat_ready: false,
      lookingState: 'looking',  // Used for new activity marker, can also be 'away', or 'back'
      newMessagesIndex: -1,     // Index in message array where New Messages notification is
      users: [],                // For membership display
      usersById: [],            // Shortcut to get user name from membership.personId
      messages: [],             // Local copy of messages
      message: '',
      // These elements are used to leverage a Webex Teams backed meeting
      teams: null,              // Teams SDK will go here
      user: null,               // The Teams User object
      roomId: ''                // Webex Teams Space that will power this chat
    }
    // hacks to test the SDK, this would normaly be in permanent storage
    // Associate user names with their token
    localStorage.setItem('jpbulk', 'MjI4YTgwZjAtZGQ1MS00MTRjLWIxNDEtZTdkZDkyMTdkZjFhMWM1MjZiMmUtNTI5')
    // Assoicate users to the rooms they belong in
    // TODO? handle logic to create rooms if none exist
    localStorage.setItem('Y2lzY29zcGFyazovL3VzL1BFT1BMRS82YWE2ZGE5OS0xYzdlLTQ4MWItODY3YS03MWY2NTIwNDk0MzM', 'Y2lzY29zcGFyazovL3VzL1JPT00vYjU0ZDJlMjAtM2VmMy0xMWU5LWJlYzQtYjE3MjI3YTI4YTBi');

  }

  componentDidMount() {
    if (this.state.username.length) {
      this.initChat();
    }
  }

  generateUID() {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 15; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    localStorage.setItem('uid', text);
    return text;
  }

  setUsername(username, e) {
    // THis is getting repurposed to set up a Webex User and a space
    // might rename setupWebexUser
    let token = localStorage.getItem(username);
    if (token) {
      // The user is a webex user
      // Initialize the SDK and make it available to the window
      let teams = (window.webexteams = initTeams({
        credentials: {
          access_token: token
        }
      }));

      if (teams) {
        // I may want to do this AFTER I've set everything up
        if (this.state.internalSocket) {
          let eventPump = new EventPump(teams, 
            this.messageCreated.bind(this),
            this.messageDeleted.bind(this),
            this.membershipCreated.bind(this),
            this.membershipDeleted.bind(this));
        }

        let username = '';
        let roomId = '';
        let user = null;
        let users = [];
        let usersById = [];
        let messages = [];
        let userAddedToSpace = false;
        // SDK Initialized lets get the user info and store it
        teams.people.get('me').then((userObj) => {
          user = userObj;
          user.displayName ? username = user.displayName : username = user.firstName + ' '+ user.lasName;
          roomId = localStorage.getItem(user.id);

          // Now lets get the space membership info
          return teams.memberships.list({roomId: roomId});
        }).then((memberships) => {
          for (let i=0; i<memberships.items.length; i++) {
            let member = memberships.items[i]; 
            usersById[member.personId] = member.personDisplayName;
            users = users.concat([member.personDisplayName]);
          }
          let isMe = memberships.items.find(m => m.personId === user.id);
          if (!isMe) {
            userAddedToSpace = true;
            return teams.memberships.create({
              personId: this.state.user.id,
              roomId: roomId
            });
          } else {
            return Promise.resolve(isMe);
          }
        }).then((myMembership) => {
          if (userAddedToSpace) {
            usersById[myMembership.personId] = myMembership.personDisplayName;
            users = users.concat([myMembership.personDisplayName]);
          }
          // Now lets get the messages
          return teams.messages.list({
            roomId: roomId,
            max: 20
          });
        }).then((messageList) => {
          for (let i=messageList.items.length-1; i>=0; i--) {
            let msg = messageList.items[i]; 
            messages =messages.concat([{
              username: usersById[msg.personId],    // This will not work if the author has left the space, 
                                                   // better would be to check for that case and query the id via /people
              uid: 12345,         // Maybe don't need this anymore
              message: {
                type: 'message',
                text: msg.html ? msg.html : msg.text
              }
            }]);
          }
          return this.setState({
            user: user,
            username: username,
            users: users,
            usersById: usersById,
            messages: messages,
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

  initChat() {
    // Not sure if I need this...
    localStorage.setItem('username', this.state.username);
    this.setState({
      chat_ready: true,
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


  removeNewMessageIndicator(e) {
    if ((this.state.newMessagesIndex > -1) &&
      (this.state.newMessagesIndex < this.state.messages.length)) {
      this.state.messages.splice(this.state.newMessagesIndex, 1);
      this.setState({
        lookingState: 'looking',
        newMessagesIndex: -1
      });
    }
  }

  sendMessage(message, e) {
    console.log(message);
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

  messageCreated(msgId, roomId) {
    if (roomId != this.state.roomId) {
      console.log(
        'Ignoring message event for a room other than the current one.\n'+
        'This type of event could be used to mark spaces as having new unread messages.'
      );
      return;
    }
    // If not update the read/unread on the space instead
    this.state.teams.messages.get(msgId).then((msg) => {
      return this.setState({
        messages: this.state.messages.concat([{
          username: this.state.usersById[msg.personId],
          uid: 12345,  // Need to figure out if I still need this
          message: {
            type: 'message',
            text: msg.html ? msg.html : msg.text
          }
        }])
      });
    }).then(() => this.scrollToBottom())
    .catch((e) => {
      alert('Got notified of a new message, but cannot get it: '+e.message);
    });
  }

  messageDeleted(msgId, roomId) {
    // TODO
    // Implement logic to update the GUI when a message is deleted
  }

  membershipCreated(membership) {
    try {
      if (membership.roomId != this.state.roomId) {
        console.log(
          'Ignoring membership event for a room other than the current one.\n'+
          'This type of event could be used to mark spaces as having new activity.'
        );
        return;
      }
      // Update the membership list
      this.state.usersById[membership.personId] = membership.personDisplayName
      this.setState({
          users: this.state.users.concat(membership.personDisplayName),
          usersById: this.state.usersById
      });
    } catch(e) {
      alert('Got notified of a new membership, but cannot get it: '+e.message);
    }
  }

  membershipDeleted(membership) {
    try {
      if (membership.roomId != this.state.roomId) {
        console.log(
          'Ignoring membership deleted event for a room other than the current one.\n'+
          'If the server is caching this type of info it could.'
        );
        return;
      }
      // Update the membership list
      delete this.state.usersById[membership.personId];
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
    // Todo Add a new socket event to notify other clients
    // this.socket.emit('message', {
    //   username: localStorage.getItem('username'),
    //   uid: localStorage.getItem('uid'),
    //   message: message,
    // });
    this.scrollToBottom();
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
            <Users users={this.state.users} />
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
              setUsername={this.setUsername.bind(this)}
            />
          )}
      </div>
    )
  }
}

export default Chat;