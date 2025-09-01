package clientconn

import (
	"github.com/gorilla/websocket"
	"time"
)

const DefaultClientConnTimeout = time.Second * 30

type ClientConnFactory interface {
	NewClientConn(wsConn *websocket.Conn, timeout time.Duration) ClientConn
}

type DefaultClientConnFactory struct{}

func (f *DefaultClientConnFactory) NewClientConn(wsConn *websocket.Conn, timeout time.Duration) ClientConn {
	conn := defaultClientConn{
		ws:      wsConn,
		timeout: timeout,
	}

	return &conn
}
