package clientconn

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/gorilla/websocket"
	"io"
	"strings"
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
		return c.resolveError(fmt.Errorf("clientconn nextwriter error: %w", err))
	}

	for _, part := range payload {
		if _, err = w.Write(part); err != nil {
			_ = w.Close()
			c.Close()

			return c.resolveError(fmt.Errorf("clientconn write error: %w", err))
		}
	}

	if err = w.Close(); err != nil {
		c.Close()
		return c.resolveError(fmt.Errorf("clientconn close writer error: %w", err))
	}

	return nil
}

func (c *defaultClientConn) Listen() ([]byte, error) {
	_, reader, err := c.ws.NextReader()
	if err != nil {
		c.Close()
		return nil, c.resolveError(fmt.Errorf("clientconn nextreader error: %w", err))
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		c.Close()
		return nil, c.resolveError(fmt.Errorf("clientconn read error: %w", err))
	}

	return data, nil
}

func (c *defaultClientConn) resolveError(err error) error {
	if websocket.IsCloseError(err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseAbnormalClosure,
		websocket.CloseNoStatusReceived,
		websocket.ClosePolicyViolation,
	) || strings.Contains(err.Error(), "closed network connection") {
		return ws_errors.ConnectionClosedErr
	}
	return err
}
