package hostconn

import (
	"context"
	"encoding/binary"
	"errors"
	"github.com/gorilla/websocket"
	"math/rand"
	"sync"
)

// TODO:
// - Comments
// - handling connection closeup
// - returning errors and create error types for example not found etc
// - make it possible to close the connection: break the listen and send methods
// - Add close handler for removing from the server

const (
	sizeOfQueryIdInBytes = 4
)

// Errors
var ConnectionClosedErr = errors.New("host connection has been closed")

// TODO: proper comments
type Conn interface {
	Query(query []byte) ([]byte, error)
	Close() error
}

type message struct {
	msg     []byte
	queryId uint32
	err     error
}

type DefaultConn struct {
	wsConn *websocket.Conn
	closed bool

	ctx        context.Context
	cancelFunc context.CancelFunc
	cancelErr  error
	closeMu    sync.Mutex

	queryCh            chan message
	responseChannels   map[uint32]chan message
	responseChannelsMu sync.Mutex
}

var _ Conn = (*DefaultConn)(nil)

// NewHostConnection returns an initialized connection to the host and start the listen and send goroutines
func NewHostConnection(wsConn *websocket.Conn) Conn {
	ctx, cancel := context.WithCancel(context.Background())

	conn := DefaultConn{
		wsConn:           wsConn,
		ctx:              ctx,
		cancelFunc:       cancel,
		responseChannels: make(map[uint32]chan message),
		queryCh:          make(chan message),
	}

	go conn.listen()
	go conn.send()

	return &conn
}

func (conn *DefaultConn) Query(query []byte) ([]byte, error) {
	queryId, responseCh := conn.createNewResponseChannel()
	msg := message{
		msg:     query,
		queryId: queryId,
	}

	select {
	case <-conn.ctx.Done():
		return nil, conn.cancelErr
	case conn.queryCh <- msg:
	}

	select {
	case <-conn.ctx.Done():
		return nil, conn.cancelErr
	case resp := <-responseCh:
		return resp.msg, resp.err
	}
}

// TODO:
func (conn *DefaultConn) Close() error {
	conn.closeMu.Lock()
	defer conn.closeMu.Unlock()
	if conn.closed {
		return nil
	}
	conn.closed = true

	conn.cancelFunc()
	return conn.wsConn.Close()
}

func (conn *DefaultConn) closeWithError(err error) error {
	closeErr := conn.Close()
	if closeErr != nil {
		return closeErr
	}

	if conn.cancelErr == nil {
		conn.cancelErr = err
	}
	return nil
}

func (conn *DefaultConn) send() {
	for !conn.closed {
		var query message
		select {
		case <-conn.ctx.Done():
			return
		case query = <-conn.queryCh:
		}

		msg, err := getBinaryDataFromQuery(query)
		if err != nil {
			panic(err)
		}

		err = conn.wsConn.WriteMessage(websocket.BinaryMessage, msg)
		if err != nil {
			_ = conn.closeWithError(err)
			return
		}
	}
}

func (conn *DefaultConn) listen() {
	for !conn.closed {
		_, msg, err := conn.wsConn.ReadMessage()
		if err != nil {
			_ = conn.closeWithError(err)
			return
		}

		result := getMessageFromBinaryData(msg)
		conn.responseChannelsMu.Lock()

		select {
		case <-conn.ctx.Done():
			return
		case conn.responseChannels[result.queryId] <- result:
		}
		delete(conn.responseChannels, result.queryId)
		conn.responseChannelsMu.Unlock()
	}
}

func (conn *DefaultConn) createNewResponseChannel() (uint32, <-chan message) {
	conn.responseChannelsMu.Lock()
	defer conn.responseChannelsMu.Unlock()

	for {
		newQueryId := rand.Uint32()
		if _, ok := conn.responseChannels[newQueryId]; !ok {
			responseChannel := make(chan message)
			conn.responseChannels[newQueryId] = responseChannel

			return newQueryId, responseChannel
		}
	}
}

func getBinaryDataFromQuery(query message) ([]byte, error) {
	msg := make([]byte, 0, len(query.msg)+sizeOfQueryIdInBytes)

	msg, err := binary.Append(msg, binary.BigEndian, query.queryId)
	if err != nil {
		panic(err)
	}

	msg, err = binary.Append(msg, binary.BigEndian, query.msg)
	if err != nil {
		panic(err)
	}

	return msg, err
}

func getMessageFromBinaryData(data []byte) message {
	i := 0
	queryId := binary.BigEndian.Uint32(data[i:sizeOfQueryIdInBytes])
	i += sizeOfQueryIdInBytes

	msg := data[i:]

	return message{
		msg:     msg,
		queryId: queryId,
	}
}
