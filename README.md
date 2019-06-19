# webex-custom-web-client

This project provides an example of how a developer who is building a messaging application using the Webex JS SDK could implement a custom client.  It focuses primarily on demonstrating Message and Membership eventing and "read receipts". 
* Message and Membership events means that the SDK based app is "notified" when a new event occurs, and does not, for example, need to "poll" to see if new messages are available
* Read Receipts means that the app can provide functionality to indicate if other users have read your message, or show which of your messages are unread

**Use of this code is at your own risk!**  This sample is simply a demonstration of how a developer could implement a "custom messaging client" using the webex SDK.  **NO WARRANTY IS IMPLIED!**


## Background

This sample was originally started by a developer with very little front end development experience and is based on a [JS, Node and sockets based chat example](https://quantizd.com/build-chat-app-with-express-react-socket-io/) found on the internet.   The original intention was to demonstrate how read receipts and message events could be implemented using features that have recently been exposed in the [webex javascript SDK](https://www.npmjs.com/package/webex).

As a result of this starting point, this sample is not a frontend-only application.  It does require starting a server which simply serves the initial page.  All chat functionality is implemented in client side javascript leveraging the Webex JS SDK.

The functionality in this sample is focused exclusively on demonstrating event based messaging and read receipts.  To that end we have omitted chat functionality features such as login, guest user creation, webex space creation, membership management, etc.   In addition, this sample does not attempt to manage more than one space.   What it does implement is a "sign in" page where the user can choose from a pre-configured set of Webex users. Once seletected the GUI will show some details about a pre-configured space assigned to that user.  The GUI will show all the members off the space, a kludgy "read status" for each user, and a chat window where the user can read and post messages.

With regards to understanding when a user has "read" the messages that are being displayed, there is some art to determining the right way to do this.  Applications may use mouse clicks, timers, window focus and a variety of methods to determine read status.  There is no cannonical "right way" to do this.  For simplicity's sake, this sample includes a "Stop Looking" and a "Start Looking" button.  When the user clicks "Stop Looking" messages will not be displayed.  When the user clicks "Start Looking", messages are displayed with a New Message indicator showing which messages arrived in the meantime.  A read receipt is sent to Webex whenever the user is looking and receives a message, or when the user clicks on "Start Looking" and then sends a message.

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

The heart of the client side logic resides in the Chat.js module.   While this is probably not a good reference for implementing a chat application user interface,  it is useful for understanding how a Chat application would interact with the webex sdk interfaces for discovering information about messages and member read status in a space.

## Eventing

The webex SDK now supports an event model where applications can register to "listen" to membership, message, and room events.  After our sample application initializes the SDK it calls the following functions:

* messages.listen() -- once this function returns, the application may register for the following event
  * messages.on("created") - this function is called when a new message is posted in a space our user is in
  * messages.on("deleted") - this function is called when a message is deleted in a space our user is in
* memberships.listen()
  * memberships.on("created") - this function is called when a new user is added to a space we are in, or if our user is added to a new space
  * memberships.on("deleted") - this function is called when a user, including our user, is removed from a space we are in
  * memberships.on("updated") - this function is called when a user's membership changes.  Usually this is when their moderator status changes
  * memberships.on("seen") - this function is called when a user in a space we are in sends a read receipt 
* rooms.listen()
  * rooms.on("created") - this function is called when our user creates a new space, or another user creates a space with our user in the initial set of members
  * rooms.on("updated") - this function is called when a user modifies a space.  Usually this means the title has changed
  
 These events correlate with the [webhooks that are generated by the Webex platform](https://developer.webex.com/docs/api/guides/webhooks/filtering-webhooks). In general the SDK events closely match the payload of the webhooks, except in cases where the information in a traditional webhook envelope doesn't make sense, for example there is no <em>name, targetUrl</em>, or <em>secret</em> field in the SDK event envelope.

The SDK adds one event which is not yet supported in the webhooks.  A <em>memberships:seen</em> event is generated when a Webex client sends a "read receipt".   The <em>membership:seen</em> event will include a <em>lastSeenId</em> field with the id of the last message read by the user.


## Tracking and setting read status for users

The "read receipt" event described above, occurs only when a client SENDS a read receipt to the webex platform.   A third pary client will need to do this task.  To support this, the webex SDK now supports four additional functions to aid in discovering and generating information on read status:

* [rooms.getWithReadStatus(roomID)](https://webex.github.io/webex-js-sdk/api/#roomsgetwithreadstatus) - returns details about our users read status.  The response object includes a `lastActivityDate` and a `lastSeenDate`.  If `lastActivityDate` is more recent than `lastSeenDate`, there are new messages in this space that our user has not seen yet.
* [roomslistWithReadStatus(maxRecent)](https://webex.github.io/webex-js-sdk/api/#roomslistwithreadstatus) - returns a list of all spaces the user is in.   Each room in the list includes a `lastActivityDate` and a `lastSeenDate`.  If `lastActivityDate` is more recent than `lastSeenDate`, there are new messages in this space that our user has not seen yet.   This request does NOT support pagination and can take a long time.  It supports an optional `maxRecent` parameter, which, when set, will limit the response to up to 100 rooms that have had activity in the last two weeks.  This can be useful to quickly update the GUI after initial login.
* [memberships.listWithReadStatus({roomId})](https://webex.github.io/webex-js-sdk/api/#membershipslistwithreadstatus) - this function returns a list with membership info for the room object (or roomId) that was passed to it.  Each membership objec tin the list includes a  `lastSeenDate`, which can be compared with the `lastActivity` attribute of the space.  It also includes a `lastSeenId` which can be compared with the most recent message ID for the space.
* [memberships.updateLastSeen({roomId, messageId})](https://webex.github.io/webex-js-sdk/api/#updatelastseen) - this function "sends" a read receipt for our user and updates the lastSeenId for a given space to the messageID that was passed.   A message object can be passed directly to this function


## Post Messages with File Attachments

It is not necessarily clear from the Webex JSSDK documentation that it is possible to post messages with an attachment that consists of a file on the browser's local file system.

The Chat.js client has been crudely hacked to demonstrate the use of this.  In the bottom left hand corner is a button called "Browse" which is implemented using the HTML form's "input" tag with the "type=file" attribute. When the user browses to a file on the browsers file system, the form data is sent to the sendFile method with an element that represents the selected file packaged in a way that allows the browser to stream this file from disk.  

The sendFile method simply calls the SDK's native messages.create() function passing it a message object which includes the roomId and the file object passed as an array to the "files" element.  The SDK then posts this file to the space.   

The GUI has NOT been implemented to support sending text and a file in the same message.  This is left as an exercise to the reader.

## Contributing

This project was inspired to support a specific customer use case, but with some additional work it could become a more generic refrence for how to build a non Cisco branded custom web client.   Check out the [To Do List](./TODO.md), if you would like to contribute.

