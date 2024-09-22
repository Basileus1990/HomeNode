package hostconn

import (
	"encoding/binary"
	"github.com/gorilla/websocket"
	"math/rand"
	"sync"
)

// TODO:
// - Comments
// - handling connection closeup
// - returning errors and create error types for example not found etc
// - write/read using binary not text
// - make it possible to close the connection: break the listen and send methods

// Message types. Each type indicates the format of the Message. Used for further parsing
// Not using itoa so it is easier to change in future
const (
	MessageTypeFromHost     = 0
	MessageTypeError        = 1
	MessageTypePingSend     = 2
	MessageTypePingResponse = 3
)

// Message binary params sizes
const (
	sizeOfQueryIdInBytes = 4
	sizeOfTypeInBytes    = 4
)

// TODO: proper comments
type Conn interface {
	Query(query Message) (Message, error)
}

// Message represent the data which will be sent to and from the websocket.
// Content's format can be determined from the Type.
type Message struct {
	Content []byte
	Type    uint32
	queryId uint32
}

type DefaultConn struct {
	wsConn *websocket.Conn

	queryCh            chan Message
	responseChannels   map[uint32]chan Message
	responseChannelsMx sync.Mutex
}

var _ Conn = (*DefaultConn)(nil)

// NewDefaultConnection returns an initialized connection to the host and start the listen and send goroutines
func NewDefaultConnection(wsConn *websocket.Conn) Conn {
	conn := DefaultConn{
		wsConn:           wsConn,
		responseChannels: make(map[uint32]chan Message),
		queryCh:          make(chan Message),
	}

	go conn.listen()
	go conn.send()

	return &conn
}

func (conn *DefaultConn) Query(query Message) (Message, error) {
	queryId, responseCh := conn.createNewResponseChannel()
	query.queryId = queryId

	conn.queryCh <- query
	return <-responseCh, nil
}

func (conn *DefaultConn) send() {
	for query := range conn.queryCh {
		msg, err := getBinaryDataFromQuery(query)
		if err != nil {
			panic(err)
		}

		err = conn.wsConn.WriteMessage(websocket.BinaryMessage, msg)
		if err != nil {
			panic(err)
		}
	}
}

func (conn *DefaultConn) listen() {
	for {
		_, message, err := conn.wsConn.ReadMessage()
		if err != nil {
			panic(err)
		}

		result := getMessageFromBinaryData(message)
		conn.responseChannelsMx.Lock()
		conn.responseChannels[result.queryId] <- result
		delete(conn.responseChannels, result.queryId)
		conn.responseChannelsMx.Unlock()
	}
}

func (conn *DefaultConn) createNewResponseChannel() (uint32, <-chan Message) {
	conn.responseChannelsMx.Lock()
	defer conn.responseChannelsMx.Unlock()

	for {
		newQueryId := rand.Uint32()
		if _, ok := conn.responseChannels[newQueryId]; !ok {
			responseChannel := make(chan Message)
			conn.responseChannels[newQueryId] = responseChannel

			return newQueryId, responseChannel
		}
	}
}

func getBinaryDataFromQuery(query Message) ([]byte, error) {
	msg := make([]byte, 0, len(query.Content)+sizeOfQueryIdInBytes+sizeOfTypeInBytes)

	msg, err := binary.Append(msg, binary.BigEndian, query.queryId)
	if err != nil {
		panic(err)
	}

	msg, err = binary.Append(msg, binary.BigEndian, query.Type)
	if err != nil {
		panic(err)
	}

	msg, err = binary.Append(msg, binary.BigEndian, query.Content)
	if err != nil {
		panic(err)
	}

	return msg, err
}

func getMessageFromBinaryData(data []byte) Message {
	i := 0
	queryId := binary.BigEndian.Uint32(data[i:sizeOfQueryIdInBytes])
	i += sizeOfQueryIdInBytes
	messageType := binary.BigEndian.Uint32(data[i : i+sizeOfQueryIdInBytes])
	i += sizeOfQueryIdInBytes
	msg := data[i:]

	return Message{
		Content: msg,
		Type:    messageType,
		queryId: queryId,
	}
}
