# webex-custom-web-client To Do list

This project provides an example of how a developer who is building a messaging application using the Webex JS SDK could implement a custom client, but it is extremely simple.  Completing the following tasks would make it more interesting and usable.   Pull Requests gladly reviewed! 

- [ ] Support room lists.  Today the app allows login from a hardcoded list of user tokens, and roomId.   Better would be to discover the rooms that the user is in and present a "recents" list like we do in the clients and widgets and allow users to switch between rooms
- [ ] Support files.   Show links to attached files.  Allow users to post files.  The current "Files" button only kind of works (and should be moved to the message composition window)
- [ ] Better rich text display support.  Properly display messages with html
- [ ] Allow users to send markdown message
- [ ] Login with token.  Make this more flexbile so that any user who can copy their auth token from the developer portal can use the app.
- [ ] Login as an integration.  Allow users to navigate to a Cisco authorization page to authorize the app to act as a client on their behalf.   Would require adding token, storage and refresh logic.   This might be better to implement when Cisco provides a way to "invalidate" an auth token when the app is done.
- [ ] Add some Activities (ie: create a new space, modify memberships, etc)