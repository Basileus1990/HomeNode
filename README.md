# Easy File Transfer
The goal of this project is to make sending files through internet as easy as possible.
It will be possible to host a folder/file and share it either by a link or an accounts


# TODO:
## Server:
- [ ] Host and User should be able to connect to a server via websocket connection through which all communication
  - Package has to be able to send messages
  - Package has to be able to receive messages
  - Has to be behind an interface for the ease of testing
- [ ] Create communication protocol
  - Getting the list of files from host (josn)
  - sending files
- [ ] Create CLI client and host for tasting purposes
