// Package hostconn provides a high-level wrapper around WebSocket connections
// that implements a query-response pattern with automatic message routing
// and timeout handling.
//
// The package enables concurrent request-response communication over WebSocket
// connections by associating each query with a unique ID and routing responses
// back to the appropriate caller.
//
// The package handles concurrent queries automatically and ensures thread-safe
// operation across multiple goroutines.
package hostconn

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"sync"
	"sync/atomic"
	"time"
)

const (
	queryIdSizeInBytes  = 4
	defaultQueryTimeout = 30 * time.Second
)

var (
	// ErrConnectionClosed is returned when attempting to perform operations on a connection that has been already closed.
	ErrConnectionClosed = errors.New("connection closed")

	// ErrQueryTimeout is returned when a query does not receive a response within the specified timeout duration.
	ErrQueryTimeout = errors.New("query timeout")

	// ErrInvalidResponse is returned when the received response does not
	// conform to the expected binary protocol format (missing query ID).
	ErrInvalidResponse = errors.New("invalid response format")
)

type Conn interface {
	// Query sends a query and waits for a response using the default timeout which is set at 30 seconds.
	// Multiple concurrent queries are supported and will be properly routed to their respective callers based on query IDs.
	//
	// The query parameter will be sent as the payload portion of the message, with a unique query ID automatically prepended.
	//
	// Returns the response payload (without the query ID) or an error if the operation fails or times out.
	// On any error other than timeout error the connection is closed, so there is no need to close it again
	Query(query []byte) ([]byte, error)

	// QueryWithTimeout sends a query and waits for a response within the specified timeout.
	// Multiple concurrent queries are supported and will be properly routed to their respective callers.
	//
	// The query parameter will be sent as the payload portion of the message, with a unique query ID automatically prepended.
	// The timeout parameter specifies the maximum time to wait for a response.
	// If the timeout is exceeded, ErrQueryTimeout is returned.
	//
	// Returns the response payload or an error if the operation fails or times out.
	// On any error other than timeout error the connection is closed, so there is no need to close it again
	QueryWithTimeout(query []byte, timeout time.Duration) ([]byte, error)

	// Close terminates the connection and cleans up all associated resources.
	// After calling Close, all pending and future queries will fail with ErrConnectionClosed.
	// Close is safe to call multiple times and from multiple goroutines.
	//
	// Returns any error encountered while closing the underlying WebSocket connection.
	Close() error
}

// DefaultConn is the default implementation of the Conn interface. It manages a WebSocket connection with
// automatic query ID generation, response routing, and connection lifecycle management.
//
// The connection operates with two background goroutines:
// - send: handles outgoing queries from the queryCh channel
// - listen: handles incoming responses and routes them to waiting queries
type DefaultConn struct {
	wsConn *websocket.Conn

	ctx        context.Context
	cancelFunc context.CancelFunc

	nextQueryId uint32

	queryCh            chan []byte
	responseChannels   map[uint32]chan []byte
	responseChannelsMu sync.Mutex

	closeOnce    sync.Once
	closeErr     error
	closeMu      sync.RWMutex
	closeHandler func()
}

var _ Conn = (*DefaultConn)(nil)

func (conn *DefaultConn) Query(query []byte) ([]byte, error) {
	return conn.QueryWithTimeout(query, defaultQueryTimeout)
}

func (conn *DefaultConn) QueryWithTimeout(query []byte, timeout time.Duration) ([]byte, error) {
	if err := conn.getCloseError(); err != nil {
		return nil, err
	}

	queryId, responseCh := conn.createNewResponseChannel()
	defer conn.cleanupResponseChannel(queryId)

	binaryQuery := getBinaryFromQuery(queryId, query)

	ctx, cancel := context.WithTimeout(conn.ctx, timeout)
	defer cancel()

	// Send the query
	select {
	case conn.queryCh <- binaryQuery:
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrQueryTimeout
		}
		return nil, conn.getCloseError()
	}

	// Wait for response
	select {
	case response := <-responseCh:
		return response, nil
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrQueryTimeout
		}
		return nil, conn.getCloseError()
	}
}

func (conn *DefaultConn) Close() error {
	var err error
	conn.closeOnce.Do(func() {
		// Maybe send close message

		conn.cancelFunc()
		err = conn.wsConn.Close()
		conn.setCloseError(ErrConnectionClosed)
		conn.closeHandler()
	})
	return err
}

func (conn *DefaultConn) closeWithError(err error) {
	conn.closeOnce.Do(func() {
		conn.setCloseError(err)
		conn.cancelFunc()
		_ = conn.wsConn.Close()
		conn.closeHandler()
	})
}

func (conn *DefaultConn) setCloseError(err error) {
	conn.closeMu.Lock()
	defer conn.closeMu.Unlock()
	if conn.closeErr == nil {
		conn.closeErr = err
	}
}

func (conn *DefaultConn) getCloseError() error {
	conn.closeMu.RLock()
	defer conn.closeMu.RUnlock()
	return conn.closeErr
}

func (conn *DefaultConn) send() {
	defer func() {
		// Clean up on exit
		conn.closeWithError(ErrConnectionClosed)
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		case binQuery := <-conn.queryCh:
			if err := conn.wsConn.WriteMessage(websocket.BinaryMessage, binQuery); err != nil {
				conn.closeWithError(fmt.Errorf("write error: %w", err))
				return
			}
		}
	}
}

func (conn *DefaultConn) listen() {
	defer func() {
		// Clean up on exit
		conn.closeWithError(ErrConnectionClosed)
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		default:
			_, response, err := conn.wsConn.ReadMessage()
			if err != nil {
				if websocket.IsCloseError(err,
					websocket.CloseNormalClosure,
					websocket.CloseGoingAway,
					websocket.CloseAbnormalClosure,
				) {
					conn.closeWithError(ErrConnectionClosed)
					return
				}
			}

			if err = conn.handleResponse(response); err != nil {
				conn.closeWithError(err)
				return
			}
		}
	}
}

func (conn *DefaultConn) handleResponse(response []byte) error {
	queryId, result, err := getResponseFromBinary(response)
	if err != nil {
		return err
	}

	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	responseCh, ok := conn.responseChannels[queryId]
	if !ok {
		return nil
	}

	select {
	case responseCh <- result:
	default:
		// Channel is full or closed, ignore
	}

	return nil
}

func (conn *DefaultConn) createNewResponseChannel() (uint32, <-chan []byte) {
	id := atomic.AddUint32(&conn.nextQueryId, 1)

	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	respCh := make(chan []byte, 1)
	conn.responseChannels[id] = respCh

	return id, respCh
}

func (conn *DefaultConn) cleanupResponseChannel(queryId uint32) {
	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	if ch, exists := conn.responseChannels[queryId]; exists {
		close(ch)
		delete(conn.responseChannels, queryId)
	}
}

func getBinaryFromQuery(queryId uint32, query []byte) []byte {
	buf := make([]byte, 4+len(query))
	binary.BigEndian.PutUint32(buf[0:4], queryId)
	copy(buf[4:], query)
	return buf
}

func getResponseFromBinary(data []byte) (uint32, []byte, error) {
	if len(data) < queryIdSizeInBytes {
		return 0, nil, ErrInvalidResponse
	}

	queryId := binary.BigEndian.Uint32(data[0:queryIdSizeInBytes])
	msg := data[queryIdSizeInBytes:]

	return queryId, msg, nil
}
