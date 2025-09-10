package host

import (
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestInitialiseNewHostConnection(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.InitWithUuidQuery.Binary(), helpers.UUIDToBinary(id)}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.InitialiseNewHostConnection(id)

		assert.NoError(t, err)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}

		mockHostMap.On("Get", id).Return(nil, false)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.InitialiseNewHostConnection(id)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host not found error")
		mockHostMap.AssertExpectations(t)
	})

	t.Run("error: query returns error", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.InitWithUuidQuery.Binary(), helpers.UUIDToBinary(id)}
		queryErr := errors.New("network problem")
		mockConn.On("Query", expectedQuery).Return(nil, queryErr)
		mockConn.On("Close").Return()

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.InitialiseNewHostConnection(id)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "error on quering newly connected host")
		assert.True(t, errors.Is(err, queryErr))

		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("error: unexpected response from host", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)
		mockConn.On("Close").Return()

		expectedQuery := [][]byte{message_types.InitWithUuidQuery.Binary(), helpers.UUIDToBinary(id)}
		mockConn.On("Query", expectedQuery).Return([]byte("NO"), nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.InitialiseNewHostConnection(id)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected first response from host")
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})
}

func TestGetResourceMetadata(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(message_types.ACK.Binary(), nil)

		expectedResponse := message_types.ACK.Binary()

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		assert.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("success: host query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", hostId).Return(mockConn, true)

		expectedQuery := [][]byte{message_types.MetadataQuery.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})
}

func TestDownloadResouce(t *testing.T) {
	t.Run("error - host not found", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(nil, false)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "host not found error", err.Error())
	})

	t.Run("error - download init query error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(123),
		}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
	})

	t.Run("error - invalid download init host response", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := []byte{1}
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - download init error message type send with error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - invalid host response - too small for download id", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
		}()

		mockHostMap.On("Get", hostId).Return(mockHostConn, true)

		expectedDownloadInitQuery := [][]byte{
			message_types.DownloadInitRequest.Binary(),
			helpers.UUIDToBinary(resourceId),
			helpers.Uint32ToBinary(123),
		}
		downloadInitResponse := message_types.DownloadInitResponse.Binary()
		mockHostConn.On("Query", expectedDownloadInitQuery).Return(downloadInitResponse, nil)

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - download init response - send to client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "some error from send client", err.Error())
	})

	t.Run("error - handleDownloadLoop - client listen error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "some client listen error", err.Error())
	})

	t.Run("error - handleDownloadLoop - client response invalid body", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "invalid message body error", err.Error())
	})

	t.Run("error - handleDownloadLoop - unexpected client message type", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "unexpected message type error", err.Error())
	})

	t.Run("error - handleunexpected - chunk request host error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "chunk request host error", err.Error())
	})

	t.Run("error - handleunexpected - chunk request client error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "client send chunk response error", err.Error())
	})

	t.Run("error - handleunexpected - download completion query send error", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "downloadCompletionQuerySendError", err.Error())
	})

	t.Run("success", func(t *testing.T) {
		hostId := uuid.New()
		resourceId := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockHostConn := &hostconn.MockConn{}
		mockClientConn := &clientconn.MockClientConn{}
		defer func() {
			mockHostMap.AssertExpectations(t)
			mockHostConn.AssertExpectations(t)
			mockClientConn.AssertExpectations(t)
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

		svc := NewHostService(mockHostMap, config.WebsocketCfg{BatchSize: 123})
		err := svc.DownloadResource(mockClientConn, hostId, resourceId)

		assert.NoError(t, err)
	})
}
