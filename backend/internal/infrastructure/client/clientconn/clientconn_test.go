package clientconn

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type testServer struct {
	server   *httptest.Server
	upgrader websocket.Upgrader

	closeHandlerCalled bool
}

func newTestServer() *testServer {
	ts := &testServer{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", ts.handleWebSocket)
	ts.server = httptest.NewServer(mux)

	return ts
}

func (ts *testServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ts.upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err,
				websocket.CloseNormalClosure,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
				websocket.CloseNoStatusReceived,
				websocket.ClosePolicyViolation,
			) {
				return
			}
			log.Fatalf("error on reading message: %v", err)
		}

		switch string(message) {
		case "timeout":
			continue
		case "close":
			return
		default:
			if err := conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				if websocket.IsCloseError(err,
					websocket.CloseNormalClosure,
					websocket.CloseGoingAway,
					websocket.CloseAbnormalClosure,
					websocket.CloseNoStatusReceived,
					websocket.ClosePolicyViolation,
				) {
					return
				}
				log.Fatalf("error on writing message: %v", err)
			}
		}
	}
}

func (ts *testServer) url() string {
	return "ws" + strings.TrimPrefix(ts.server.URL, "http")
}

func (ts *testServer) close() {
	ts.server.Close()
}

func createTestConnection(t *testing.T, server *testServer) ClientConn {
	t.Helper()

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(server.url(), nil)
	require.NoError(t, err)

	clientConn := (&DefaultClientConnFactory{}).NewClientConn(conn)

	return clientConn
}

func TestSendSuccess(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	err := conn.Send([]byte("hello"))
	assert.NoError(t, err)

	returnMessage, err := conn.Listen()
	assert.NoError(t, err)
	assert.Equal(t, []byte("hello"), returnMessage)

	err = conn.Send([]byte("hello"), []byte(" "), []byte("world"))
	assert.NoError(t, err)

	returnMessage, err = conn.Listen()
	assert.NoError(t, err)
	assert.Equal(t, []byte("hello world"), returnMessage)

	err = conn.Send([]byte(""))
	assert.NoError(t, err)

	returnMessage, err = conn.Listen()
	assert.NoError(t, err)
	assert.Equal(t, []byte(""), returnMessage)
}

func TestSendAfterClose(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	conn.Close()

	err := conn.Send([]byte("hello"))
	require.ErrorIs(t, err, ws_errors.ConnectionClosedErr)
}

func TestListenAfterClose(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)

	err := conn.Send([]byte("hello"))
	assert.NoError(t, err)

	conn.Close()

	returnMessage, err := conn.Listen()
	assert.ErrorIs(t, err, ws_errors.ConnectionClosedErr)
	assert.Nil(t, returnMessage)
}
