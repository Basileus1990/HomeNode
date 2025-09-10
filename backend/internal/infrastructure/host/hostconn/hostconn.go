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
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/gorilla/websocket"
	"sync"
	"sync/atomic"
	"time"
)

const (
	queryIdSizeInBytes  = 4
	defaultQueryTimeout = 30 * time.Second
)

type HostConn interface {
	// Query sends a query and waits for a response using the default timeout which is set at 30 seconds.
	// Multiple concurrent queries are supported and will be properly routed to their respective callers based on query IDs.
	//
	// All byte arras will be sent in one message in order they have been provided, with a unique query ID automatically prepended.
	//
	// Returns the response payload (without the query ID) or an error if the operation fails or times out.
	// On any error other than timeout error the connection is closed, so there is no need to close it again
	Query(query ...[]byte) ([]byte, error)

	// QueryWithTimeout sends a query and waits for a response within the specified timeout.
	// Multiple concurrent queries are supported and will be properly routed to their respective callers.
	//
	// The query parameter will be sent as the payload portion of the message, with a unique query ID automatically prepended.
	// The timeout parameter specifies the maximum time to wait for a response.
	// If the timeout is exceeded, ws_errors.TimeoutErr is returned.
	//
	// Returns the response payload or an error if the operation fails or times out.
	// On any error other than timeout error the connection is closed, so there is no need to close it again
	QueryWithTimeout(timeout time.Duration, query ...[]byte) ([]byte, error)

	// Close terminates the connection and cleans up all associated resources.
	// After calling Close, all pending and future queries will fail with ErrConnectionClosed.
	// Close is safe to call multiple times and from multiple goroutines.
	Close()
}

// defaultHostConn is the default implementation of the HostConn interface. It manages a WebSocket connection with
// automatic query ID generation, response routing, and connection lifecycle management.
//
// The connection operates with two background goroutines:
// - send: handles outgoing queries from the queryCh channel
// - listen: handles incoming responses and routes them to waiting queries
type defaultHostConn struct {
	ws *websocket.Conn

	ctx        context.Context
	cancelFunc context.CancelFunc

	nextQueryId uint32

	queryCh            chan [][]byte
	responseChannels   map[uint32]chan []byte
	responseChannelsMu sync.Mutex

	closeOnce    sync.Once
	closeErr     error
	closeMu      sync.RWMutex
	closeHandler func()
}

var _ HostConn = (*defaultHostConn)(nil)

func (conn *defaultHostConn) Query(query ...[]byte) ([]byte, error) {
	return conn.QueryWithTimeout(defaultQueryTimeout, query...)
}

func (conn *defaultHostConn) QueryWithTimeout(timeout time.Duration, query ...[]byte) ([]byte, error) {
	if err := conn.getCloseError(); err != nil {
		return nil, err
	}

	queryId, responseCh := conn.createNewResponseChannel()
	defer conn.cleanupResponseChannel(queryId)

	queryWithId := addQueryIdToQuery(query, queryId)

	ctx, cancel := context.WithTimeout(conn.ctx, timeout)
	defer cancel()

	// Send the query
	select {
	case conn.queryCh <- queryWithId:
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ws_errors.TimeoutErr
		}
		return nil, conn.getCloseError()
	}

	// Wait for response
	select {
	case response := <-responseCh:
		return response, nil
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ws_errors.TimeoutErr
		}
		return nil, conn.getCloseError()
	}
}

func (conn *defaultHostConn) Close() {
	conn.closeOnce.Do(func() {
		conn.cancelFunc()
		_ = conn.ws.Close()
		conn.setCloseError(ws_errors.ConnectionClosedErr)
		conn.closeHandler()
	})
}

func (conn *defaultHostConn) closeWithError(err error) {
	conn.closeOnce.Do(func() {
		conn.setCloseError(err)
		conn.cancelFunc()
		_ = conn.ws.Close()
		conn.closeHandler()
	})
}

func (conn *defaultHostConn) setCloseError(err error) {
	conn.closeMu.Lock()
	defer conn.closeMu.Unlock()
	if conn.closeErr == nil {
		conn.closeErr = err
	}
}

func (conn *defaultHostConn) getCloseError() error {
	conn.closeMu.RLock()
	defer conn.closeMu.RUnlock()
	return conn.closeErr
}

func (conn *defaultHostConn) send() {
	defer func() {
		// Clean up on exit
		conn.closeWithError(ws_errors.ConnectionClosedErr)
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		case query := <-conn.queryCh:
			w, err := conn.ws.NextWriter(websocket.BinaryMessage)
			if err != nil {
				conn.closeWithError(fmt.Errorf("hostconn nextwriter error: %w", err))
				return
			}

			for _, part := range query {
				if _, err = w.Write(part); err != nil {
					_ = w.Close()
					conn.closeWithError(fmt.Errorf("hostconn write error: %w", err))
					return
				}
			}

			if err = w.Close(); err != nil {
				conn.closeWithError(fmt.Errorf("hostconn close writer error: %w", err))
				return
			}
		}
	}
}

func (conn *defaultHostConn) listen() {
	defer func() {
		// Clean up on exit
		conn.closeWithError(ws_errors.ConnectionClosedErr)
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		default:
			_, response, err := conn.ws.ReadMessage()
			if err != nil {
				if websocket.IsCloseError(err,
					websocket.CloseNormalClosure,
					websocket.CloseGoingAway,
					websocket.CloseAbnormalClosure,
				) {
					conn.closeWithError(ws_errors.ConnectionClosedErr)
					return
				}

				conn.closeWithError(err)
				return
			}

			if err = conn.handleResponse(response); err != nil {
				conn.closeWithError(err)
				return
			}
		}
	}
}

func (conn *defaultHostConn) handleResponse(response []byte) error {
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

func (conn *defaultHostConn) createNewResponseChannel() (uint32, <-chan []byte) {
	id := atomic.AddUint32(&conn.nextQueryId, 1)

	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	respCh := make(chan []byte, 1)
	conn.responseChannels[id] = respCh

	return id, respCh
}

func (conn *defaultHostConn) cleanupResponseChannel(queryId uint32) {
	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	if ch, exists := conn.responseChannels[queryId]; exists {
		close(ch)
		delete(conn.responseChannels, queryId)
	}
}

func addQueryIdToQuery(query [][]byte, queryId uint32) [][]byte {
	binQueryId := helpers.Uint32ToBinary(queryId)

	newQuery := make([][]byte, 0, len(query)+1)
	newQuery = append(newQuery, binQueryId)
	newQuery = append(newQuery, query...)

	return newQuery
}

func getResponseFromBinary(data []byte) (uint32, []byte, error) {
	if len(data) < queryIdSizeInBytes {
		return 0, nil, ws_errors.InvalidMessageBodyErr
	}

	queryId := binary.BigEndian.Uint32(data[0:queryIdSizeInBytes])
	msg := data[queryIdSizeInBytes:]

	return queryId, msg, nil
}
