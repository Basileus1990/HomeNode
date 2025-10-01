package host

import (
	"context"
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host/saved_connections_repository"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"testing"
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
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

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		expectedResponse := message_types.ACK.Binary()

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

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

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
		mockSavedConnectionsRepo.AssertExpectations(t)
	})
}

func TestDownloadResouce(t *testing.T) {
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := []byte{1}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.Error.Binary()
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{message_types.Error.Binary()}).Return(errors.New("some error from send client"))

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
			helpers.Uint32ToBinary(1),
		}).Return(errors.New("some error from send client"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return(nil, errors.New("some client listen error"))

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return([]byte{1}, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
			helpers.Uint32ToBinary(1),
		}).Return(nil)

		mockClientConn.On("Listen").Return([]byte{1, 2}, nil)

		mockHostConn.On("Query", [][]byte{
			message_types.DownloadCompletionRequest.Binary(),
			helpers.Uint32ToBinary(888),
		}).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

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
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(888)...) // downloadId
		downloadInitResponse = append(downloadInitResponse, helpers.Uint32ToBinary(1)...)   // some payload
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		mockClientConn.On("Send", [][]byte{
			message_types.DownloadInitResponse.Binary(),
			helpers.Uint32ToBinary(123),
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123}, &mockSavedConnectionsRepo)
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		assert.NoError(t, err)
	})
}
