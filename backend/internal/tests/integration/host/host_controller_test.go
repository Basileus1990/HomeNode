package host

import (
	"context"
	"fmt"
	hostController "github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host/saved_connections_repository"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type testContext struct {
	server            *httptest.Server
	wsURL             string
	ctx               context.Context
	hostMap           hostmap.HostMap
	hostService       host.HostService
	mockRepo          *MockSavedConnectionsRepository
	clientConnFactory clientconn.ClientConnFactory
}

type MockSavedConnectionsRepository struct {
	mock.Mock
}

func (m *MockSavedConnectionsRepository) GetById(ctx context.Context, id uuid.UUID) (*saved_connections_repository.SavedConnection, error) {
	args := m.Called(ctx, id)
	if sc, ok := args.Get(0).(*saved_connections_repository.SavedConnection); ok {
		return sc, args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockSavedConnectionsRepository) AddOrRenew(ctx context.Context, sc saved_connections_repository.SavedConnection) error {
	args := m.Called(ctx, sc)
	return args.Error(0)
}

func setupTestEnvironment(t *testing.T) *testContext {
	t.Helper()

	ctx := context.Background()

	hostConnFactory := &hostconn.DefaultHostConnFactory{}
	hostMap := hostmap.NewDefaultHostMap(ctx, hostConnFactory)

	mockRepo := &MockSavedConnectionsRepository{}
	mockRepo.On("AddOrRenew", mock.Anything, mock.Anything).Return(nil).Maybe()
	mockRepo.On("GetById", mock.Anything, mock.Anything).Return(nil, nil).Maybe()

	hostService := host.NewHostService(hostMap, mockRepo)
	clientConnFactory := &clientconn.DefaultClientConnFactory{}

	gin.SetMode(gin.TestMode)
	router := gin.New()

	controller := &hostController.Controller{
		HostService: hostService,
		WebsocketCfg: config.WebsocketCfg{
			BatchSize: 1024,
		},
		ClientConnFactory: clientConnFactory,
	}

	group := router.Group("/api/v1/host")
	controller.SetUpRoutes(group)

	server := httptest.NewServer(router)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	return &testContext{
		server:            server,
		wsURL:             wsURL,
		ctx:               ctx,
		hostMap:           hostMap,
		hostService:       hostService,
		mockRepo:          mockRepo,
		clientConnFactory: clientConnFactory,
	}
}

func connectWebSocket(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(url, nil)
	require.NoError(t, err)
	return conn
}

func readMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) []byte {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(timeout))
	_, msg, err := conn.ReadMessage()
	require.NoError(t, err)
	return msg
}

func writeMessage(t *testing.T, conn *websocket.Conn, parts ...[]byte) {
	t.Helper()
	msg := []byte{}
	for _, part := range parts {
		msg = append(msg, part...)
	}
	err := conn.WriteMessage(websocket.BinaryMessage, msg)
	require.NoError(t, err)
}

// simulateHostConnection connects as a host and completes the handshake
func simulateHostConnection(t *testing.T, tc *testContext) (uuid.UUID, string, *websocket.Conn) {
	t.Helper()

	hostConn := connectWebSocket(t, tc.wsURL+"/api/v1/host/connect")

	// Read the init query
	msg := readMessage(t, hostConn, 2*time.Second)
	queryId := msg[:4]
	msg = msg[4:]
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	require.Equal(t, message_types.InitWithUuidQuery, msgType)

	// Extract host UUID and key
	require.True(t, len(msg) >= 2+16, "message too short for UUID")
	hostID, err := uuid.FromBytes(msg[2:18])
	require.NoError(t, err)

	keyBytes := msg[18:]
	hostKey := string(keyBytes[:len(keyBytes)-1]) // Remove null terminator

	// Send ACK
	writeMessage(t, hostConn, queryId, message_types.ACK.Binary())

	return hostID, hostKey, hostConn
}

// TestHostConnect tests the /connect endpoint end-to-end
func TestHostConnect(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	hostConn := connectWebSocket(t, tc.wsURL+"/api/v1/host/connect")
	defer hostConn.Close()

	// Read the init query
	msg := readMessage(t, hostConn, 2*time.Second)
	msg = msg[4:] // removing the respondent id
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.InitWithUuidQuery, msgType)

	// Extract host UUID
	require.True(t, len(msg) >= 2+16, "message too short for UUID")
	hostID, err := uuid.FromBytes(msg[2:18])
	require.NoError(t, err)

	// Extract the host key
	keyBytes := msg[18:]
	hostKey := string(keyBytes[:len(keyBytes)-1])
	assert.NotEmpty(t, hostKey)

	// Send ACK
	writeMessage(t, hostConn, message_types.ACK.Binary())

	// Verify host is in the map
	_, exists := tc.hostMap.Get(hostID)
	assert.True(t, exists)

	tc.mockRepo.AssertExpectations(t)
}

// TestHostReconnect tests the /reconnect/:hostUuid endpoint end-to-end
func TestHostReconnect(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// First, connect a host to get credentials
	hostID, hostKey, firstConn := simulateHostConnection(t, tc)

	// Setup mock to return the saved connection
	tc.mockRepo.On("GetById", mock.Anything, hostID).Return(&saved_connections_repository.SavedConnection{
		Id:      hostID,
		KeyHash: helpers.HashString(hostKey),
	}, nil)

	// Close the first connection
	firstConn.Close()
	time.Sleep(100 * time.Millisecond)

	// Reconnect using the same credentials
	url := fmt.Sprintf("%s/api/v1/host/reconnect/%s?hostKey=%s", tc.wsURL, hostID.String(), hostKey)
	reconnConn := connectWebSocket(t, url)
	defer reconnConn.Close()

	// Read the init existing host query
	msg := readMessage(t, reconnConn, 2*time.Second)
	msg = msg[4:] // removing respondent id
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.InitExistingHost, msgType)

	// Send ACK
	writeMessage(t, reconnConn, message_types.ACK.Binary())

	// Verify host is in the map
	_, exists := tc.hostMap.Get(hostID)
	assert.True(t, exists)

	tc.mockRepo.AssertExpectations(t)
}

// TestGetResourceMetadata tests the /metadata/:hostUuid/:resourceUuid/* endpoint end-to-end
func TestGetResourceMetadata(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(t, tc)
	defer hostConn.Close()

	// Set up a goroutine to handle the host's response
	resourceID := uuid.New()
	path := "/test/file.txt"
	metadataPayload := []byte("file-metadata-content")

	go func() {
		// Host receives metadata query
		msg := readMessage(t, hostConn, 5*time.Second)
		queryID := msg[:4]
		msg = msg[4:]
		msgType, err := message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.MetadataQuery, msgType)

		// Send response
		response := append(queryID, message_types.MetadataResponse.Binary()...)
		response = append(response, metadataPayload...)
		writeMessage(t, hostConn, response)
	}()

	// Connect as client to request metadata
	url := fmt.Sprintf("%s/api/v1/host/metadata/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)
	clientConn := connectWebSocket(t, url)
	defer clientConn.Close()

	// Read response
	msg := readMessage(t, clientConn, 5*time.Second)
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.MetadataResponse, msgType)

	payload := msg[2:] // Skip message type
	assert.Equal(t, metadataPayload, payload)
}

// TestDownloadResource tests the /download/:hostUuid/:resourceUuid/* endpoint end-to-end
func TestDownloadResource(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(t, tc)
	defer hostConn.Close()

	resourceID := uuid.New()
	path := "/test/file.txt"
	downloadID := uint32(123)
	chunkData := []byte("chunk-data-content")

	go func() {
		// Host receives download init request
		msg := readMessage(t, hostConn, 5*time.Second)
		queryID := msg[:4]
		msg = msg[4:]
		msgType, err := message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.DownloadInitRequest, msgType)

		// Send download init response
		response := append(queryID, message_types.DownloadInitResponse.Binary()...)
		response = append(response, helpers.Uint32ToBinary(downloadID)...)
		response = append(response, []byte("init-payload")...)
		writeMessage(t, hostConn, response)

		// Wait for chunk request
		msg = readMessage(t, hostConn, 5*time.Second)
		queryID = msg[:4]
		msg = msg[4:]
		msgType, err = message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.ChunkRequest, msgType)

		// Send chunk response
		response = append(queryID, message_types.ChunkResponse.Binary()...)
		response = append(response, chunkData...)
		writeMessage(t, hostConn, response)

		// Wait for download completion
		msg = readMessage(t, hostConn, 5*time.Second)
		queryID = msg[:4]
		msg = msg[4:]
		msgType, err = message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.DownloadCompletionRequest, msgType)

		writeMessage(t, hostConn, append(queryID, message_types.ACK.Binary()...))
	}()

	// Connect as client to download
	url := fmt.Sprintf("%s/api/v1/host/download/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)
	clientConn := connectWebSocket(t, url)
	defer clientConn.Close()

	// Read download init response
	msg := readMessage(t, clientConn, 5*time.Second)
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.DownloadInitResponse, msgType)

	// Send chunk request
	chunkRequest := append(message_types.ChunkRequest.Binary(), []byte("chunk-request-data")...)
	writeMessage(t, clientConn, chunkRequest)

	// Read chunk response
	msg = readMessage(t, clientConn, 5*time.Second)
	msgType, err = message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.ChunkResponse, msgType)

	payload := msg[2:]
	assert.Equal(t, chunkData, payload)

	// Send download completion
	writeMessage(t, clientConn, message_types.DownloadCompletionRequest.Binary())
	time.Sleep(100 * time.Millisecond)
}

// TestCreateDirectory tests the /directory/create/:hostUuid/:resourceUuid/* endpoint end-to-end
func TestCreateDirectory(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(t, tc)
	defer hostConn.Close()

	resourceID := uuid.New()
	path := "/test/newdir"

	go func() {
		// Host receives create directory request
		msg := readMessage(t, hostConn, 5*time.Second)
		queryID := msg[:4]
		msg = msg[4:]
		msgType, err := message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.CreateDirectory, msgType)

		// Send ACK response
		response := append(queryID, message_types.ACK.Binary()...)
		writeMessage(t, hostConn, response)
	}()

	// Connect as client to create directory
	url := fmt.Sprintf("%s/api/v1/host/directory/create/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)
	clientConn := connectWebSocket(t, url)
	defer clientConn.Close()

	// Read response
	msg := readMessage(t, clientConn, 5*time.Second)
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.ACK, msgType)
}

// TestDeleteResource tests the /resource/delete/:hostUuid/:resourceUuid/* endpoint end-to-end
func TestDeleteResource(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(t, tc)
	defer hostConn.Close()

	resourceID := uuid.New()
	path := "/test/file.txt"

	go func() {
		// Host receives delete resource request
		msg := readMessage(t, hostConn, 5*time.Second)
		queryID := msg[:4]
		msg = msg[4:]
		msgType, err := message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.DeleteResource, msgType)

		// Send ACK response
		response := append(queryID, message_types.ACK.Binary()...)
		writeMessage(t, hostConn, response)
	}()

	// Connect as client to delete resource
	url := fmt.Sprintf("%s/api/v1/host/resource/delete/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)
	clientConn := connectWebSocket(t, url)
	defer clientConn.Close()

	// Read response
	msg := readMessage(t, clientConn, 5*time.Second)
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.ACK, msgType)
}

// TestCreateFile tests the /file/create/:hostUuid/:resourceUuid/* endpoint end-to-end
func TestCreateFile(t *testing.T) {
	tc := setupTestEnvironment(t)
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(t, tc)
	defer hostConn.Close()

	resourceID := uuid.New()
	path := "/test/newfile.txt"
	fileSize := uint32(1024)
	streamID := uint32(456)
	chunkData := []byte("uploaded-chunk-data")

	go func() {
		// Host receives create file init request
		msg := readMessage(t, hostConn, 5*time.Second)
		queryID := msg[:4]
		msg = msg[4:]
		msgType, err := message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.CreateFileInitRequest, msgType)

		// Send create file init response
		response := append(queryID, message_types.CreateFileInitResponse.Binary()...)
		response = append(response, helpers.Uint32ToBinary(streamID)...)
		writeMessage(t, hostConn, response)

		// Send chunk request to client
		msg = readMessage(t, hostConn, 5*time.Second)
		queryID = msg[:4]
		msg = msg[4:]
		msgType, err = message_types.GetMsgType(msg)
		require.NoError(t, err)
		assert.Equal(t, message_types.CreateFileHostChunkRequest, msgType)

		response = append(queryID, message_types.CreateFileHostChunkRequest.Binary()...)
		response = append(response, []byte("chunk-request-data")...)
		writeMessage(t, hostConn, response)

		// Receive chunk data from client
		msg = readMessage(t, hostConn, 5*time.Second)
		queryID = msg[:4]
		msg = msg[4:]

		// Send ACK for chunk
		writeMessage(t, hostConn, append(queryID, message_types.ACK.Binary()...))

		// Send another chunk request
		msg = readMessage(t, hostConn, 5*time.Second)
		queryID = msg[:4]
		msg = msg[4:]

		// Send completion
		writeMessage(t, hostConn, append(queryID, message_types.CreateFileStreamEnd.Binary()...))
	}()

	// Connect as client to create file
	url := fmt.Sprintf("%s/api/v1/host/file/create/%s/%s%s?uploadFileSize=%d",
		tc.wsURL, hostID.String(), resourceID.String(), path, fileSize)
	clientConn := connectWebSocket(t, url)
	defer clientConn.Close()

	// Read create file init response
	msg := readMessage(t, clientConn, 5*time.Second)
	msgType, err := message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.CreateFileInitResponse, msgType)

	// Read chunk request
	msg = readMessage(t, clientConn, 5*time.Second)
	msgType, err = message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.CreateFileHostChunkRequest, msgType)

	// Send chunk data
	writeMessage(t, clientConn, chunkData)

	// Read next chunk request (which will be completion)
	msg = readMessage(t, clientConn, 5*time.Second)
	msgType, err = message_types.GetMsgType(msg)
	require.NoError(t, err)
	assert.Equal(t, message_types.CreateFileStreamEnd, msgType)

	time.Sleep(100 * time.Millisecond)
}
