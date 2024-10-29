package hostconn

import (
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"net/http"
	"net/url"
	"testing"
)

type fakeHostConnection struct {
	serverHostConn Conn
	clientWsConn   *websocket.Conn
	clientErr      error
	server         *http.Server
	clientResponse string
}

func newFakeHostConnection(clientResponse string) *fakeHostConnection {
	fakeHostConn := fakeHostConnection{
		clientResponse: clientResponse,
	}

	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	var hostConn Conn
	handler := func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			panic("failed upgrading the connection")
		}
		hostConn = NewHostConnection(conn)
	}

	router := gin.Default()
	router.Any("/", handler)
	srv := &http.Server{
		Addr:    ":12345",
		Handler: router.Handler(),
	}

	go func() {
		_ = srv.ListenAndServe()
	}()

	fakeHostConn.server = srv

	u := url.URL{Scheme: "ws", Host: "localhost:12345", Path: "/"}
	clientConn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	fakeHostConn.clientWsConn = clientConn
	if err != nil {
		panic(err)
	}

	srv.Shutdown(context.Background())

	go func() {
		for {
			_, msg, err := clientConn.ReadMessage()
			if err != nil {
				fakeHostConn.clientErr = err
				return
			}

			err = clientConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("%s%s", msg[:4], fakeHostConn.clientResponse)))
			if err != nil {
				fakeHostConn.clientErr = err
				return
			}
		}
	}()

	fakeHostConn.serverHostConn = hostConn
	return &fakeHostConn
}

func TestSuccessfulConnection(t *testing.T) {
	connection := newFakeHostConnection("test")

	resp, err := connection.serverHostConn.Query([]byte("Test123"))
	assert.NoError(t, err)
	assert.NoError(t, connection.clientErr)
	assert.Equal(t, "test", string(resp))
}

func TestClientClose(t *testing.T) {
	connection := newFakeHostConnection("test")

	_ = connection.clientWsConn.Close()
	resp, err := connection.serverHostConn.Query([]byte("Test"))
	assert.NoError(t, err)
	assert.Equal(t, "test", string(resp))
}
