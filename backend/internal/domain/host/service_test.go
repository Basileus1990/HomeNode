package host

import (
	"context"
	"errors"
	"testing"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host/saved_connections_repository"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestInitialiseNewHostConnection(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockWs := &websocket.Conn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("AddNew", mockWs).Return(id)
		mockHostMap.On("Get", id).Return(mockConn, true)

		mockConn.On("Query", mock.Anything).Return(message_types.ACK.Binary(), nil)
		mockSavedConnectionsRepo.On("AddOrRenew", mock.Anything, mock.Anything).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitNewHostConnection(context.Background(), mockWs)

		assert.NoError(t, err)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockWs := &websocket.Conn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("AddNew", mockWs).Return(id)
		mockHostMap.On("Get", id).Return(nil, false)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitNewHostConnection(context.Background(), mockWs)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host not found error")
		mockHostMap.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("error: query returns error", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockWs := &websocket.Conn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("AddNew", mockWs).Return(id)
		mockHostMap.On("Get", id).Return(mockConn, true)

		queryErr := errors.New("network problem")
		mockConn.On("Query", mock.Anything).Return(nil, queryErr)
		mockConn.On("Close").Return()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitNewHostConnection(context.Background(), mockWs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "error on quering newly connected host")
		assert.True(t, errors.Is(err, queryErr))

		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("error: unexpected response from host", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockWs := &websocket.Conn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("AddNew", mockWs).Return(id)
		mockHostMap.On("Get", id).Return(mockConn, true)
		mockConn.On("Close").Return()

		mockConn.On("Query", mock.Anything).Return([]byte("NO"), nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitNewHostConnection(context.Background(), mockWs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected first response from host")
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("error: error on AddOrRenew saved_connection", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockWs := &websocket.Conn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("AddNew", mockWs).Return(id)
		mockHostMap.On("Get", id).Return(mockConn, true)
		mockConn.On("Close").Return()

		mockConn.On("Query", mock.Anything).Return(message_types.ACK.Binary(), nil)
		mockSavedConnectionsRepo.On("AddOrRenew", mock.Anything, mock.Anything).Return(errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitNewHostConnection(context.Background(), mockWs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "test error")

		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})
}

func TestInitExistingHostConnection(t *testing.T) {
	t.Run("host already connected", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "already connected")
	})

	t.Run("saved connection get error", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "test error")
	})

	t.Run("invalid host key error", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: "some hash",
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid host key error")
	})

	t.Run("host map add error", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil)
		mockHostMap.On("Add", mockWs, hostId).Return(errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "test error")
	})

	t.Run("host map new host not found", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false).Once()
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil).Once()
		mockHostMap.On("Add", mockWs, hostId).Return(nil).Once()
		mockHostMap.On("Get", hostId).Return(nil, false).Once()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "host not found error")
	})

	t.Run("query error", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false).Once()
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil).Once()
		mockHostMap.On("Add", mockWs, hostId).Return(nil).Once()
		mockHostMap.On("Get", hostId).Return(mockConn, true).Once()
		mockConn.On("Query", mock.Anything).Return([]byte{66}, errors.New("test error")).Once()
		mockConn.On("Close").Return()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "test error")
	})

	t.Run("query invalid response", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false).Once()
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil).Once()
		mockHostMap.On("Add", mockWs, hostId).Return(nil).Once()
		mockHostMap.On("Get", hostId).Return(mockConn, true).Once()
		mockConn.On("Query", mock.Anything).Return([]byte{66}, nil)
		mockConn.On("Close").Return()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected first response from host")
	})

	t.Run("add or renew saved connection error", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false).Once()
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil).Once()
		mockHostMap.On("Add", mockWs, hostId).Return(nil).Once()
		mockHostMap.On("Get", hostId).Return(mockConn, true).Once()
		mockConn.On("Query", mock.Anything).Return(message_types.ACK.Binary(), nil).Once()
		mockSavedConnectionsRepo.On("AddOrRenew", mock.Anything, mock.Anything).Return(errors.New("test error")).Once()
		mockConn.On("Close").Return().Once()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "test error")
	})

	t.Run("success", func(t *testing.T) {
		hostId := uuid.New()
		hostKey := "abc"
		savedConnection := saved_connections_repository.SavedConnection{
			Id:      hostId,
			KeyHash: helpers.HashString(hostKey),
		}

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockWs := &websocket.Conn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false).Once()
		mockSavedConnectionsRepo.On("GetById", mock.Anything, hostId).Return(&savedConnection, nil).Once()
		mockHostMap.On("Add", mockWs, hostId).Return(nil).Once()
		mockHostMap.On("Get", hostId).Return(mockConn, true).Once()
		mockConn.On("Query", mock.Anything).Return(message_types.ACK.Binary(), nil).Once()
		mockSavedConnectionsRepo.On("AddOrRenew", mock.Anything, mock.Anything).Return(nil).Once()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.InitExistingHostConnection(context.Background(), mockWs, hostId, hostKey)

		assert.NoError(t, err)
	})
}

func TestGetResourceMetadata(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId), []byte("abc/cba\000")}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		expectedResponse := message_types.ACK.Binary()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId, "abc/cba")

		assert.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})

	t.Run("success: host query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId), []byte("bbb\000")}
		mockConn.On("Query", expectedQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId, "bbb")

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})
}

func TestDownloadResource(t *testing.T) {
	t.Run("error - host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
	})

	t.Run("error - download init query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
	})

	t.Run("error - invalid download init host response", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := []byte{1}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - download init error message type send with error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.Error.Binary()
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{message_types.Error.Binary()}).Return(errors.New("some error from send client"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - invalid host response - too small for download id", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - download init response - send to client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(errors.New("some error from send client"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - handleDownloadLoop - client listen error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return(nil, errors.New("some client listen error"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "some client listen error", err.Error())
	})

	t.Run("error - handleDownloadLoop - client response invalid body", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return([]byte{1}, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - handleDownloadLoop - unexpected client message type", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return([]byte{1, 2}, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "unexpected message type error", err.Error())
	})

	t.Run("error - handleunexpected - chunk request host error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(1),
		}).Return(nil)

		clientListenResp := message_types.ChunkRequest.Binary()
		clientListenResp = append(clientListenResp, 1) // some payload
		mockClientConn.On("Listen").Return(clientListenResp, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.ChunkRequest.Binary(),
			helpers.Uint32ToBinary(888),
			{1},
		}).Return(nil, errors.New("chunk request host error"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "chunk request host error", err.Error())
	})

	t.Run("error - handleunexpected - chunk request client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),

			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		clientListenResp := message_types.ChunkRequest.Binary()
		clientListenResp = append(clientListenResp, 1) // some payload
		mockClientConn.On("Listen").Return(clientListenResp, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.ChunkRequest.Binary(),
			helpers.Uint32ToBinary(888),
			{1},
		}).Return([]byte{123}, nil)

		mockClientConn.On("Send", [][]byte{
			{123},
		}).Return(errors.New("client send chunk response error"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "client send chunk response error", err.Error())
	})

	t.Run("error - handleunexpected - download completion query send error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),

			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		clientListenResp := message_types.ChunkRequest.Binary()
		clientListenResp = append(clientListenResp, 1) // some payload
		mockClientConn.On("Listen").Return(clientListenResp, nil).Once()

		mockHostConn.On("Query", [][]byte{
			message_types.ChunkRequest.Binary(),
			helpers.Uint32ToBinary(888),
			{1},
		}).Return([]byte{123}, nil)

		mockClientConn.On("Send", [][]byte{
			{123},
		}).Return(nil)

		mockClientConn.On("Listen").Return(message_types.DownloadCompletionRequest.Binary(), nil).Once()

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(nil, errors.New("downloadCompletionQuerySendError"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		require.Error(t, err)
		assert.Equal(t, "downloadCompletionQuerySendError", err.Error())
	})

	t.Run("success", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),

			[]byte("aaa\000"),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),

			helpers.Uint32ToBinary(1),
		}).Return(nil)

		clientListenResp := message_types.ChunkRequest.Binary()
		clientListenResp = append(clientListenResp, 1) // some payload
		mockClientConn.On("Listen").Return(clientListenResp, nil).Once()

		mockHostConn.On("Query", [][]byte{
			message_types.ChunkRequest.Binary(),
			helpers.Uint32ToBinary(888),
			{1},
		}).Return([]byte{123}, nil)

		mockClientConn.On("Send", [][]byte{
			{123},
		}).Return(nil)

		mockClientConn.On("Listen").Return(message_types.DownloadCompletionRequest.Binary(), nil).Once()

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(nil, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId, "aaa")

		assert.NoError(t, err)
	})
}

func TestCreateDirectory(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{
			message_types.CreateDirectory.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("path/to/dir\000"),
		}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		expectedResponse := message_types.ACK.Binary()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.CreateDirectory(hostId, resourceId, "path/to/dir")

		assert.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
	})

	t.Run("error: host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.CreateDirectory(hostId, resourceId, "some/path")

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
		assert.Nil(t, resp)
	})

	t.Run("error: host query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{
			message_types.CreateDirectory.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("another/path\000"),
		}
		mockConn.On("Query", expectedQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.CreateDirectory(hostId, resourceId, "another/path")

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
		assert.Nil(t, resp)
	})
}

func TestDeleteDirectory(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()

		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{
			message_types.DeleteResource.Binary(),
			helpers.UUIDToBinary(resourceId),
			[]byte("path/to/dir\000"),
		}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		expectedResponse := message_types.ACK.Binary()

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		resp, err := svc.DeleteResource(hostId, resourceId, "path/to/dir")

		assert.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
	})
}

func TestCreateFile(t *testing.T) {
	t.Run("error - host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
	})

	t.Run("error - create file init query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
	})

	t.Run("error - invalid create file init host response", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := []byte{1}
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - create file init error message type send with error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.Error.Binary()
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{message_types.Error.Binary()}).Return(errors.New("some error from send client"))

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - invalid host response - too small for stream id", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - create file init response - send to client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(errors.New("some error from send client"))
		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - handleUploadLoop - host chunk request query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil)

		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(nil, errors.New("host chunk request error"))

		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "host chunk request error", err.Error())
	})

	t.Run("error - handleUploadLoop - host chunk request invalid message type", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil)

		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return([]byte{1}, nil)

		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - handleUploadLoop - host signals error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil)

		hostErrorResp := message_types.Error.Binary()
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostErrorResp, nil)

		mockClientConn.On("Send", [][]byte{hostErrorResp}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		assert.NoError(t, err)
	})

	t.Run("error - handleUploadLoop - host signals completion", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil)

		hostCompletionResp := message_types.CreateFileStreamEnd.Binary()
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostCompletionResp, nil)

		mockClientConn.On("Send", [][]byte{hostCompletionResp}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		assert.NoError(t, err)
	})

	t.Run("error - handleUploadLoop - forward chunk request to client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil)

		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(errors.New("client send error"))
		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "client send error", err.Error())
	})

	t.Run("error - handleUploadLoop - client listen error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil)

		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(nil)
		mockClientConn.On("Listen").Return(nil, errors.New("client listen error"))
		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "client listen error", err.Error())
	})

	t.Run("error - handleUploadLoop - forward chunk to host error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil).Once()

		clientChunkData := []byte{4, 5, 6}
		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(nil)
		mockClientConn.On("Listen").Return(clientChunkData, nil)
		mockHostConn.On("Query", [][]byte{clientChunkData}).Return(nil, errors.New("host query chunk error"))
		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "host query chunk error", err.Error())
	})

	t.Run("error - handleUploadLoop - host chunk processing invalid message type", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil).Once()

		clientChunkData := []byte{4, 5, 6}
		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(nil)
		mockClientConn.On("Listen").Return(clientChunkData, nil)
		mockHostConn.On("Query", [][]byte{clientChunkData}).Return([]byte{1}, nil)
		mockClientConn.On("Send", [][]byte{message_types.CreateFileStreamEnd.Binary()}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - handleUploadLoop - host signals error after chunk processing", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil).Once()

		clientChunkData := []byte{4, 5, 6}
		hostErrorResp := message_types.Error.Binary()
		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(nil)
		mockClientConn.On("Listen").Return(clientChunkData, nil)
		mockHostConn.On("Query", [][]byte{clientChunkData}).Return(hostErrorResp, nil)
		mockClientConn.On("Send", [][]byte{hostErrorResp}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		assert.NoError(t, err)
	})

	t.Run("error - handleUploadLoop - host signals completion after chunk processing", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		hostChunkReq := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq = append(hostChunkReq, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq, nil).Once()

		clientChunkData := []byte{4, 5, 6}
		hostCompletionResp := message_types.CreateFileStreamEnd.Binary()
		mockClientConn.On("Send", [][]byte{hostChunkReq}).Return(nil)
		mockClientConn.On("Listen").Return(clientChunkData, nil)
		mockHostConn.On("Query", [][]byte{clientChunkData}).Return(hostCompletionResp, nil)
		mockClientConn.On("Send", [][]byte{hostCompletionResp}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		assert.NoError(t, err)
	})

	t.Run("success - full upload cycle with multiple chunks", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockSavedConnectionsRepo := saved_connections_repository.MockSavedConnectionsRepository{}
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
			mockSavedConnectionsRepo.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedCreateFileInitQuery := [][]byte{
			message_types.CreateFileInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(1024),
			[]byte("test.txt\000"),
		}
		createFileInitResponse := message_types.CreateFileInitResponse.Binary()
		createFileInitResponse = append(createFileInitResponse, helpers.Uint32ToBinary(777)...) // streamId
		mockHostConn.On("Query", expectedCreateFileInitQuery).Return(createFileInitResponse, nil)

		mockClientConn.On("Send", [][]byte{createFileInitResponse}).Return(nil).Once()

		// First chunk
		hostChunkReq1 := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq1 = append(hostChunkReq1, []byte{1, 2, 3}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq1, nil).Once()

		clientChunkData1 := []byte{4, 5, 6}
		hostAckResp1 := message_types.ACK.Binary()
		mockClientConn.On("Send", [][]byte{hostChunkReq1}).Return(nil).Once()
		mockClientConn.On("Listen").Return(clientChunkData1, nil).Once()
		mockHostConn.On("Query", [][]byte{clientChunkData1}).Return(hostAckResp1, nil).Once()

		// Second chunk
		hostChunkReq2 := message_types.CreateFileHostChunkRequest.Binary()
		hostChunkReq2 = append(hostChunkReq2, []byte{7, 8, 9}...)
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostChunkReq2, nil).Once()

		clientChunkData2 := []byte{10, 11, 12}
		hostAckResp2 := message_types.ACK.Binary()
		mockClientConn.On("Send", [][]byte{hostChunkReq2}).Return(nil).Once()
		mockClientConn.On("Listen").Return(clientChunkData2, nil).Once()
		mockHostConn.On("Query", [][]byte{clientChunkData2}).Return(hostAckResp2, nil).Once()

		// Completion
		hostCompletionResp := message_types.CreateFileStreamEnd.Binary()
		mockHostConn.On("Query", [][]byte{
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(777),
		}).Return(hostCompletionResp, nil).Once()
		mockClientConn.On("Send", [][]byte{hostCompletionResp}).Return(nil)

		svc := NewHostService(mockHostMap, &mockSavedConnectionsRepo)
		err := svc.CreateFile(mockClientConn, hostId, resourceId, "test.txt", 1024)

		assert.NoError(t, err)
	})
}
