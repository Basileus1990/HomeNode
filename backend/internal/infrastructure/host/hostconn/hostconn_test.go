package hostconn

import (
	"context"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"
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
			//CheckOrigin: func(r *http.Request) bool {
			//	return true // Allow all origins for testing
			//},
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
			break
		}

		// Extract query ID and payload
		if len(message) < 4 {
			continue
		}

		queryID := message[:4]
		payload := message[4:]

		// Create response based on payload
		var response []byte
		switch string(payload) {
		case "ping":
			response = append(response, queryID...)
			response = append(response, []byte("pong")...)
		case "timeout":
			continue
		case "close":
			return
		default:
			response = append(response, queryID...)
			response = append(response, []byte("echo: ")...)
			response = append(response, payload...)
		}

		if err := conn.WriteMessage(websocket.BinaryMessage, response); err != nil {
			break
		}
	}
}

func (ts *testServer) url() string {
	return "ws" + strings.TrimPrefix(ts.server.URL, "http")
}

func (ts *testServer) close() {
	ts.server.Close()
}

func createTestConnection(t *testing.T, server *testServer) Conn {
	t.Helper()

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(server.url(), nil)
	require.NoError(t, err)

	ctx := context.Background()
	hostConn := (&DefaultHostConnectionFactory{}).NewHostConn(ctx, conn, func() {
		server.closeHandlerCalled = true
	})

	return hostConn
}

func createBenchmarkTestConnection(t testing.TB, server *testServer) Conn {
	t.Helper()

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(server.url(), nil)
	require.NoError(t, err)

	ctx := context.Background()
	hostConn := (&DefaultHostConnectionFactory{}).NewHostConn(ctx, conn, func() {
		server.closeHandlerCalled = true
	})

	return hostConn
}

func TestSuccessfulQuery(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	// Test basic query-response
	response, err := conn.Query([]byte("ping"))
	assert.NoError(t, err)
	assert.Equal(t, "pong", string(response))

	// Test another query
	response, err = conn.Query([]byte("ping"))
	assert.NoError(t, err)
	assert.Equal(t, "pong", string(response))
}

func TestSuccessfulMultipleQuery(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	response, err := conn.Query([]byte("abc"), []byte("cba"))
	assert.NoError(t, err)
	assert.Equal(t, "echo: abccba", string(response))

	response, err = conn.Query([]byte("abc"), []byte(""), []byte("cba"))
	assert.NoError(t, err)
	assert.Equal(t, "echo: abccba", string(response))
}

func TestQueryWithCustomTimeout(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	response, err := conn.QueryWithTimeout(5*time.Second, []byte("ping"))
	assert.NoError(t, err)
	assert.Equal(t, "pong", string(response))
}

func TestQueryZeroTimeout(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	_, err := conn.QueryWithTimeout(0, []byte("timeout"))
	assert.ErrorIs(t, err, ErrQueryTimeout)
}

func TestQueryTimeout(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	_, err := conn.QueryWithTimeout(100*time.Millisecond, []byte("timeout"))
	assert.ErrorIs(t, err, ErrQueryTimeout)
}

func TestConcurrentQueries(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	eg := errgroup.Group{}
	eg.SetLimit(runtime.NumCPU())

	const numQueries = 1000
	results := make([]string, numQueries)
	errors := make([]error, numQueries)

	for i := 0; i < numQueries; i++ {
		eg.Go(func() error {
			query := []byte("ping")
			response, err := conn.Query(query)
			results[i] = string(response)
			errors[i] = err
			return nil
		})
	}

	_ = eg.Wait()

	for i := 0; i < numQueries; i++ {
		assert.NoError(t, errors[i], "Query %d failed", i)
		assert.Equal(t, "pong", results[i], "Query %d got wrong response", i)
	}
}

func TestConnectionClose(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)

	// First query should work
	response, err := conn.Query([]byte("ping"))
	assert.NoError(t, err)
	assert.Equal(t, "pong", string(response))

	// Close the connection
	conn.Close()

	// Subsequent queries should fail
	_, err = conn.Query([]byte("ping"))
	assert.ErrorIs(t, err, ErrConnectionClosed)
	assert.True(t, server.closeHandlerCalled)
}

func TestHostCloseConnection(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	// Send a message that causes app to close connection
	_, err := conn.QueryWithTimeout(1*time.Second, []byte("close"))

	// Give some time for the cancellation to propagate
	time.Sleep(100 * time.Millisecond)

	// Should get either a connection closed error or timeout
	assert.ErrorIs(t, err, ErrConnectionClosed)
	assert.True(t, server.closeHandlerCalled)
}

func TestLargeMessage(t *testing.T) {
	server := newTestServer()
	defer server.close()

	conn := createTestConnection(t, server)
	defer conn.Close()

	largePayload := make([]byte, 1024*1024)
	for i := range largePayload {
		largePayload[i] = byte(i % 256)
	}

	response, err := conn.QueryWithTimeout(30*time.Second, largePayload)
	assert.NoError(t, err)

	expected := append([]byte("echo: "), largePayload...)
	assert.Equal(t, expected, response)
}

func TestInvalidResponse(t *testing.T) {
	// This test requires a custom app that sends invalid responses
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, err = conn.ReadMessage()
		if err != nil {
			return
		}

		// Less than 4 bytes required for query ID
		conn.WriteMessage(websocket.BinaryMessage, []byte{1, 2})
	}))
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	require.NoError(t, err)

	hostConn := (&DefaultHostConnectionFactory{}).NewHostConn(context.Background(), conn, func() {})
	defer hostConn.Close()
	
	_, err = hostConn.QueryWithTimeout(2*time.Second, []byte("test"))
	require.Error(t, err)
	assert.EqualError(t, err, "hostconn ERROR - response lenght less than 4 bytes. No query id")
}

func TestQueryAfterContextCancel(t *testing.T) {
	server := newTestServer()
	defer server.close()

	ctx, cancel := context.WithCancel(context.Background())

	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(server.url(), nil)
	require.NoError(t, err)

	hostConn := (&DefaultHostConnectionFactory{}).NewHostConn(ctx, conn, func() {
		server.closeHandlerCalled = true
	})
	defer hostConn.Close()

	// First query should work
	response, err := hostConn.Query([]byte("ping"))
	assert.NoError(t, err)
	assert.Equal(t, "pong", string(response))

	cancel()

	// Give some time for the cancellation to propagate
	time.Sleep(100 * time.Millisecond)

	_, err = hostConn.Query([]byte("ping"))
	assert.ErrorIs(t, err, ErrConnectionClosed)
	assert.True(t, server.closeHandlerCalled)
}

func BenchmarkQuery(b *testing.B) {
	server := newTestServer()
	defer server.close()

	conn := createBenchmarkTestConnection(b, server)
	defer conn.Close()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := conn.Query([]byte("ping"))
			if err != nil {
				b.Error(err)
			}
		}
	})
}

func BenchmarkConcurrentQueries(b *testing.B) {
	server := newTestServer()
	defer server.close()

	conn := createBenchmarkTestConnection(b, server)
	defer conn.Close()

	b.ResetTimer()
	b.SetParallelism(runtime.NumCPU())
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := conn.Query([]byte("ping"))
			if err != nil {
				b.Error(err)
			}
		}
	})
}
