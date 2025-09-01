package host

import (
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_consts"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
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

		expectedQuery := [][]byte{ws_consts.ServerSendUuid.Binary(), helpers.UUIDToBinary(id)}
		mockConn.On("Query", expectedQuery).Return(ws_consts.HostResponseOK.Binary(), nil)

		svc := NewHostService(mockHostMap)
		err := svc.InitialiseNewHostConnection(id)

		assert.NoError(t, err)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}

		mockHostMap.On("Get", id).Return(nil, false)

		svc := NewHostService(mockHostMap)
		err := svc.InitialiseNewHostConnection(id)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host not found")
		mockHostMap.AssertExpectations(t)
	})

	t.Run("error: query returns error", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &hostmap.MockHostMap{}
		mockConn := &hostconn.MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)

		expectedQuery := [][]byte{ws_consts.ServerSendUuid.Binary(), helpers.UUIDToBinary(id)}
		queryErr := errors.New("network problem")
		mockConn.On("Query", expectedQuery).Return(nil, queryErr)
		mockConn.On("Close").Return()

		svc := NewHostService(mockHostMap)
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

		expectedQuery := [][]byte{ws_consts.ServerSendUuid.Binary(), helpers.UUIDToBinary(id)}
		mockConn.On("Query", expectedQuery).Return([]byte("NO"), nil)

		svc := NewHostService(mockHostMap)
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

		expectedQuery := [][]byte{ws_consts.ServerQueryResourceMetadata.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(ws_consts.HostResponseOK.Binary(), nil)

		expectedResponse := ws_consts.HostResponseOK.Binary()

		svc := NewHostService(mockHostMap)
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

		svc := NewHostService(mockHostMap)
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "host not found", err.Error())
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

		expectedQuery := [][]byte{ws_consts.ServerQueryResourceMetadata.Binary(), helpers.UUIDToBinary(resourceId)}
		mockConn.On("Query", expectedQuery).Return(nil, errors.New("test error"))

		svc := NewHostService(mockHostMap)
		resp, err := svc.GetResourceMetadata(hostId, resourceId)

		require.Error(t, err)
		assert.Equal(t, "test error", err.Error())
		assert.Nil(t, resp)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})
}
