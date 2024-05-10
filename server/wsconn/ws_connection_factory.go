package wsconn

import "golang.org/x/net/websocket"

// WSConnectionCreator is the interface which wraps the creation of websocket connection object.
// This interface was made for to make it mocking websocket connections easy
//
// NewWSConnection returns a new WSConnection object based on the provided websocket.Conn.
type WSConnectionCreator interface {
	NewWSConnection(ws *websocket.Conn) WSConnection
}

type wsConnectionCreator struct{}

func (c wsConnectionCreator) NewWSConnection(ws *websocket.Conn) WSConnection {
	return wsConnection{}
}

func NewWSConnectionCreator() WSConnectionCreator {
	return wsConnectionCreator{}
}
