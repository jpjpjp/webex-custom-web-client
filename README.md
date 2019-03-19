# chatter-webex

This project provides an example of how a developer who is building a messaging application using the Webex JS SDK could implement missing features such as Message and Membership eventing and "read receipts". 
* Message and Membership events means that the SDK based app is "notified" when a new event occurs, and does not, for example, need to "poll" to see if new messages are available
* Read Receipts means that the app can provide functionality to indicate if other users have read your message, or show which of your messages are unread

**Use of this code is at your own risk!**  This sample leverages internal interfaces that Cisco does not officially support for end user developers.  What this means is that the interfaces demonstrated in this sample may change without notice from Cisco and Cisco has no responsibility to revert back to support your code.  **NO WARRANTY IS IMPLIED!**


## Background

In order to demonstrate how it is possible to build a messaging client that uses socket based message events and read receipts it was necessary to build a small messaging front end.   This sample is based on a [JS, Node and sockets based chat example](https://quantizd.com/build-chat-app-with-express-react-socket-io/) found on the internet.   The original intention was to demonstrate how read receipts and message events could be implemented **WITHOUT** using private interfaces by using a socket connection to a backend server that provides these functions.

After conversations with one company's development team, this approach was altered to initially use private interfaces (not expressly supported by Cisco).   A future version of this project may include both so that developers can compare and contrast.

As a result of this starting point, this sample is not a frontend-only application.  It does require starting a server which, at this point, simply serves the initial page.  All chat functionality is implemented in client side javascript leveraging the Webex JS SDK.

The functionality in this sample is focused exclusively on demonstrating event based messaging and read receipts.  To that end we have omitted chat functionality features such as login, guest user creation, webex space creation, membership management, etc.   In addition, this sample does not attempt to manage more than one space.   What it does implement is a "sign in" page where the user can choose from a pre-configured set of Webex users. Once seletected the GUI will show some details about a pre-configured space assigned to that user.  The GUI will show all the members off the space, a kludgy "read status" for each user, and a chat window where the user can read and post messages.

With regards to understanding when a user has "read" the messages that are being displayed, there is some art to determining the right way to do this.  Applications may use mouse clicks, timers, window focus and a variety of methods to determine read status.  There is no cannonical "right way" to do this.  For simplicity's sake, this sample includes a "Stop Looking" and a "Start Looking" button.  When the user clicks "Stop Looking" messages will not be displayed.  When the user clicks "Start Looking", messages are displayed with a New Message indicator showing which messages arrived in the meantime.  A read receipt is sent to Webex whenever the user clicks "Start Looking" or sends a message.

## Getting Started

As with any node and js based project start by installing the dependencies (which include the Webex JS SDK):

`npm install`

To avoid being bothered with server restarts, we use nodemon to monitor for changes and restart the server.  Install it prior to your first run

`npm install -g nodemon`

As mentioned above, this sample relies on a preset configuration file which defines which users and spaces will be used.  Edit the file [users-sample.json](.src/components/chat/users-sample.json) with at least two users and one space.  When you are finished rename the file ./src/components/chat/users.json

The following elements are required for each user entry:
```json
  {
    "name": "For Example: Michele Russo (remote-advisor1)", 
    "personId": "Webex person ID for Michele",
    "rooms": [
      "At least one Webex Room ID that Michele is member of is required",
      "Additional room IDs in this array are not yet leveraged"
    ],
    "token": "An authorization token needed to initialize the SDK for Michele"
  },
```
Prior to updating this file, the developer should create the users, spaces and memberships needed to support this. The name is used for display puprose in the login dialog only.  The developer must obtain the Webex IDs for each person as well as the spaces that they belong to. The token is used to initialize the SDK for that user.  It is worth mentioning that since this file contains tokens it should be carefully secured (and not, for example, posted to github).

Once the configuration file is set up, you are ready to try using the app.  Run the following commands in a terminal:

terminal 1: `npm run dev-server`

terminal 2: `npm run dev`

If both started succesfully you can point your browser to http://127.0.0.1:8989/ to begin using the app.

## Interacting with the app

If the configuration file was set up properly, it should be simple to choose one of the preconfigured users and "login" to the app.   Assuming the server is running locally, you can open additional windows to the server using different browsers to login as other users.  Your second user can also participate using a Webex Teams client.

## Understanding the new functionality

The heart of the client side logic resides in the Chat.js module.   In no way should this be considered a good reference for implementing a chat application!  It is useful though for understanding how a Chat application would interact with the new interfaces provided in two "shim" modules that expose the new functionality.

When reading through Chat.js code look for comments that include "NEW API" to find the points where the application interacts with the new functionality.

## Eventing

The eventing logic is encapsulated in EventPump module defined in [eventPump.js](src/components/chat/eventPump.js).  This module can be instantiated after the SDK is intialized.  Its constructor parameters are the initialized SDK and callback functions for message and membership events.  The callback function for message events get either an error or a message object. The callback function for membership events get either an error or a membership object.  The contstructor registers for the internal events. 

Once instantianted, the EventPump.processEvent function will convert internal message and membership events to a structure that is as similar as possible to the "data" object in the  standard message or membershp webhook payload.  There are some additional values in this object that your code can inspect:

* **lastActivity**: will be one of "created", "deleted" or "updated".  A value of "created" means a new message has been posted or a new user was added to a space.   A value of "deleted" means a user deleted their message or a user left or was removed from a space.   A value of "updated" means that some attribute of this user has changed.  This might mean that its a read receipt.
* **lastActivityDate**: this is a timestamp that indicates when the last activity occured
* **lastSeenId**: this is the message ID of the last seen message.   This field is not guaranteed to be in every payload, so code should check for it carefully.  If this field exists and the value of lastActivity is "updated" this represents a read receipt.  It is worth noting that it is possible that the ID returned in this field could point to an internal Webex "activity" that is **not** a message.   It is safe to compare this Id to existing messageIds, but application logic should not assume it is a valid messageId.

## Read Receipts

The read receipt event described above, occurs only when a client SENDS a read receipt to the webex platform.   A third pary client will need to do this task.  To support this, additional functions for read recipts have been encapsulated in a ReadInfo module defined in [readInfo.js](src/components/chat/readInfo.js).  This module can be instantiated after the SDK is intialized.  Its constructor parameter is the same user auth token that was used to instantiate the SDK.  Once instantiated this module provides two methods for managing read receipts:

* sendReceipt()  This function takes three parameters:
  * personId:  -- the webex user that you are sending the read receipt for
  * messageId: -- the last message in the space that the user has read
  * roomId: -- the webex space where the message is

When called, this module will send the read receipt info to the Webex platform, which will then distribute it to all interested clients.  For example in our application, our processMembershipEvent callback will be called by the EventPump.processEvents function with a membership object that has "lastActivity" set to "updated", and "lastSeenId" to the messageId that was passed to sendReceipt().

A chat client that can send and receive read receipts can keep its GUI up to date in real time, but when the app first starts it needs a way to get the current read receipt status for each of its members.   The other function this module provides helps with this:

* getSpaceInfo()  This function has one parameter:
  * roomId: -- the webex space to get the information for

This function will return object with an array of objects.  Each object will include:
* personId: the ID of a member of the space
* lastSeenId: the last message that the user sent a read receipt for
* lastSeenDate: the date of the last activity

This array may **not** include lastSeen information on all members in the space.   If there is no information available on the last message that they read then no the lastSeen fields will not be included in the object.

## Post Messages with File Attachments

It is not necessarily clear from the Webex JSSDK documentation that it is possible to post messages with an attachment that consists of a file on the browser's local file system.

The Chat.js client has been crudely hacked to demonstrate the use of this.  In the bottom left hand corner is a button called "Browse" which is implemented using the HTML form's "input" tag with the "type=file" attribute. When the user browses to a file on the browsers file system, the form data is sent to the sendFile method with an element that represents the selected file packaged in a way that allows the browser to stream this file from disk.  

The sendFile method simply calls the SDK's native messages.create() function passing it a message object which includes the roomId and the file object passed as an array to the "files" element.  The SDK then posts this file to the space.   

The GUI has NOT been implemented to support sending text and a file in the same message.  This is left as an exercise to the reader.

