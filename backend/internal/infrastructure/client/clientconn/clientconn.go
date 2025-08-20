package clientconn

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/gorilla/websocket"
)

type ClientConn interface {
	Send(payload ...[]byte) error
	Listen() ([]byte, error)
	Close()
}

type defaultClientConn struct {
	ws *websocket.Conn
}

func (c *defaultClientConn) Close() {
	_ = c.ws.Close()
}

func (c *defaultClientConn) Send(payload ...[]byte) error {
	w, err := c.ws.NextWriter(websocket.BinaryMessage)
	if err != nil {
		c.Close()
		return fmt.Errorf("hostconn nextwriter error: %w", err)
	}

	for _, part := range payload {
		if _, err = w.Write(part); err != nil {
			_ = w.Close()
			c.Close()

			if websocket.IsCloseError(err,
				websocket.CloseNormalClosure,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
				websocket.CloseNoStatusReceived,
				websocket.ClosePolicyViolation,
			) {
				return ws_errors.ConnectionClosedErr
			}
			return fmt.Errorf("hostconn write error: %w", err)
		}
	}

	if err = w.Close(); err != nil {
		c.Close()
		return fmt.Errorf("hostconn close writer error: %w", err)
	}

	return nil
}

func (c *defaultClientConn) Listen() ([]byte, error) {
	panic("not implemented")
}
