package clientconn

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/gorilla/websocket"
	"io"
	"log"
	"strings"
	"time"
)

type ClientConn interface {
	Send(payload ...[]byte) error
	SendAndLogError(payload ...[]byte)
	Listen() ([]byte, error)
	Close()
}

type defaultClientConn struct {
	ws      *websocket.Conn
	timeout time.Duration
}

func (c *defaultClientConn) Close() {
	_ = c.ws.Close()
}

func (c *defaultClientConn) Send(payload ...[]byte) error {
	if err := c.ws.SetWriteDeadline(time.Now().Add(c.timeout)); err != nil {
		c.Close()
		return c.resolveError(err, "clientconn set write deadline error: %w")
	}
	defer func() {
		// Clear the deadline
		_ = c.ws.SetWriteDeadline(time.Time{})
	}()

	w, err := c.ws.NextWriter(websocket.BinaryMessage)
	if err != nil {
		c.Close()
		return c.resolveError(err, "clientconn nextwriter error: %w")
	}

	for _, part := range payload {
		if _, err = w.Write(part); err != nil {
			_ = w.Close()
			c.Close()

			return c.resolveError(err, "clientconn write error: %w")
		}
	}

	if err = w.Close(); err != nil {
		c.Close()
		return c.resolveError(err, "clientconn close writer error: %w")
	}

	return nil
}

func (c *defaultClientConn) SendAndLogError(payload ...[]byte) {
	if err := c.Send(payload...); err != nil {
		log.Printf("error Client Send And Log Error: %v", err)
	}
}

func (c *defaultClientConn) Listen() ([]byte, error) {
	if err := c.ws.SetReadDeadline(time.Now().Add(c.timeout)); err != nil {
		c.Close()
		return nil, c.resolveError(err, "clientconn set write deadline error: %w")
	}
	defer func() {
		// Clear the deadline
		_ = c.ws.SetReadDeadline(time.Time{})
	}()

	_, reader, err := c.ws.NextReader()
	if err != nil {
		c.Close()
		return nil, c.resolveError(err, "clientconn nextreader error: %w")
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		c.Close()
		return nil, c.resolveError(err, "clientconn read error: %w")
	}

	return data, nil
}

func (c *defaultClientConn) resolveError(err error, wrapperFormat string) error {
	if websocket.IsCloseError(err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseAbnormalClosure,
		websocket.CloseNoStatusReceived,
		websocket.ClosePolicyViolation,
	) || strings.Contains(err.Error(), "closed network connection") {
		return ws_errors.ConnectionClosedErr
	}

	if strings.Contains(err.Error(), "timeout") {
		return ws_errors.TimeoutErr
	}

	return fmt.Errorf(wrapperFormat, err)
}
