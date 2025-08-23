package clientconn

import (
	"github.com/gorilla/websocket"
)

type ClientConnFactory interface {
	NewClientConn(wsConn *websocket.Conn) ClientConn
}

type DefaultClientConnFactory struct{}

func (f *DefaultClientConnFactory) NewClientConn(wsConn *websocket.Conn) ClientConn {
	conn := defaultClientConn{
		ws: wsConn,
	}

	return &conn
}
