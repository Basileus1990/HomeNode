package hostconn

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/gorilla/websocket"
)

type HostConnFactory interface {
	NewHostConn(ctx context.Context, wsConn *websocket.Conn, closeHandler func()) HostConn
}

// DefaultHostConnFactory creates and initializes a new connection wrapper around the provided WebSocket connection.
// It starts the necessary background goroutines for handling message sending and receiving.
//
// The provided context controls the connection lifetime. When the context
// is cancelled, the connection will be closed and all pending operations
// will be terminated.
//
// The WebSocket connection should be established and ready for communication.
type DefaultHostConnFactory struct{}

func (f *DefaultHostConnFactory) NewHostConn(ctx context.Context, wsConn *websocket.Conn, closeHandler func()) HostConn {
	ctx, cancel := context.WithCancel(ctx)

	conn := defaultHostConn{
		ws:               wsConn,
		ctx:              ctx,
		cancelFunc:       cancel,
		closeHandler:     closeHandler,
		responseChannels: make(map[uint32]chan []byte),
		queryCh:          make(chan [][]byte),
	}

	originalCloseHandler := conn.ws.CloseHandler()
	conn.ws.SetCloseHandler(func(code int, text string) error {
		_ = originalCloseHandler(code, text)
		conn.closeWithError(ws_errors.ConnectionClosedErr)
		return nil
	})

	go conn.listen()
	go conn.send()

	return &conn
}
