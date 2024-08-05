package wsconn

import "golang.org/x/net/websocket"

// WSConnectionCreator is an interface which wraps the creation of a websocket connection object.
// This interface was made to make mocking websocket connections easy
//
// NewWSConnection returns a new WSConnection object based on the provided websocket.Conn.
type WSConnectionCreator interface {
	// NewWSConnection creates a new WSConnection from a given websocket.Conn
	NewWSConnection(ws *websocket.Conn) WSConnection
}

// Main implementation of WSConnectionCreator
type wsConnectionCreator struct{}

func (c wsConnectionCreator) NewWSConnection(ws *websocket.Conn) WSConnection {
	return wsConnection{}
}

// NewWSConnectionCreator Creates main implementation of WSConnectionCreator.
// Used in production code
func NewWSConnectionCreator() WSConnectionCreator {
	return wsConnectionCreator{}
}
