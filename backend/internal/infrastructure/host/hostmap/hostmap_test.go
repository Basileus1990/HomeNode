package hostmap

import (
	"context"
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"testing"
	"time"
)

type MockConn struct {
	mock.Mock
}

func (m *MockConn) Query(query ...[]byte) ([]byte, error) {
	panic("implement me")
}

func (m *MockConn) QueryWithTimeout(timeout time.Duration, query ...[]byte) ([]byte, error) {
	panic("implement me")
}

func (m *MockConn) Close() {
	m.Called()
}

type MockHostConnFactory struct {
	mock.Mock
}

func (m *MockHostConnFactory) NewHostConn(ctx context.Context, conn *websocket.Conn, onClose func()) hostconn.HostConn {
	args := m.Called(ctx, conn, onClose)
	return args.Get(0).(hostconn.HostConn)
}

func TestDefaultHostMap_Add(t *testing.T) {
	t.Run("successfully adds a connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn)

		hostMap := NewDefaultHostMap(ctx, factory)

		id := hostMap.Add(mockWebSocketConn)

		assert.NotEqual(t, uuid.Nil, id)

		conn, exists := hostMap.Get(id)
		assert.True(t, exists)
		assert.Equal(t, mockConn, conn)

		factory.AssertExpectations(t)
	})

	t.Run("generates unique IDs", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn1 := &MockConn{}
		mockConn2 := &MockConn{}
		mockWebSocketConn1 := &websocket.Conn{}
		mockWebSocketConn2 := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn1, mock.AnythingOfType("func()")).Return(mockConn1)
		factory.On("NewHostConn", ctx, mockWebSocketConn2, mock.AnythingOfType("func()")).Return(mockConn2)

		hostMap := NewDefaultHostMap(ctx, factory)

		id1 := hostMap.Add(mockWebSocketConn1)
		id2 := hostMap.Add(mockWebSocketConn2)

		assert.NotEqual(t, id1, id2)
		assert.NotEqual(t, uuid.Nil, id1)
		assert.NotEqual(t, uuid.Nil, id2)

		factory.AssertExpectations(t)
	})
}

func TestDefaultHostMap_Remove(t *testing.T) {
	t.Run("successfully removes existing connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn)
		mockConn.On("Close").Return(nil)

		hostMap := NewDefaultHostMap(ctx, factory)

		id := hostMap.Add(mockWebSocketConn)

		// Verify it exists before removal
		_, exists := hostMap.Get(id)
		assert.True(t, exists)

		hostMap.Remove(id)

		// Verify it no longer exists
		_, exists = hostMap.Get(id)
		assert.False(t, exists)

		mockConn.AssertExpectations(t)
		factory.AssertExpectations(t)
	})

	t.Run("handles close error gracefully", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn)
		mockConn.On("Close").Return(errors.New("close error"))

		hostMap := NewDefaultHostMap(ctx, factory)

		id := hostMap.Add(mockWebSocketConn)

		hostMap.Remove(id)

		// Verify it was still removed from the map
		_, exists := hostMap.Get(id)
		assert.False(t, exists)

		mockConn.AssertExpectations(t)
		factory.AssertExpectations(t)
	})

	t.Run("handles removal of non-existent connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}

		hostMap := NewDefaultHostMap(ctx, factory)

		nonExistentID := uuid.New()

		_, exists := hostMap.Get(nonExistentID)
		assert.False(t, exists)

		hostMap.Remove(nonExistentID)

		_, exists = hostMap.Get(nonExistentID)
		assert.False(t, exists)
	})
}

func TestDefaultHostMap_Get(t *testing.T) {
	t.Run("returns existing connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn)

		hostMap := NewDefaultHostMap(ctx, factory)

		id := hostMap.Add(mockWebSocketConn)

		conn, exists := hostMap.Get(id)
		assert.True(t, exists)
		assert.Equal(t, mockConn, conn)

		factory.AssertExpectations(t)
	})

	t.Run("returns false for non-existent connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}

		hostMap := NewDefaultHostMap(ctx, factory)

		nonExistentID := uuid.New()

		conn, exists := hostMap.Get(nonExistentID)
		assert.False(t, exists)
		assert.Nil(t, conn)
	})
}

func TestDefaultHostMap_OnCloseCallback(t *testing.T) {
	t.Run("onClose callback removes connection", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		var capturedOnClose func()
		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn).Run(func(args mock.Arguments) {
			capturedOnClose = args.Get(2).(func())
		})

		hostMap := NewDefaultHostMap(ctx, factory)

		id := hostMap.Add(mockWebSocketConn)

		// Verify connection exists
		_, exists := hostMap.Get(id)
		assert.True(t, exists)

		// Call the onClose callback
		capturedOnClose()

		// Verify connection was removed
		_, exists = hostMap.Get(id)
		assert.False(t, exists)

		factory.AssertExpectations(t)
	})
}

func TestDefaultHostMap_EdgeCases(t *testing.T) {
	t.Run("multiple removes of same ID", func(t *testing.T) {
		ctx := context.Background()
		factory := &MockHostConnFactory{}
		mockConn := &MockConn{}
		mockWebSocketConn := &websocket.Conn{}

		factory.On("NewHostConn", ctx, mockWebSocketConn, mock.AnythingOfType("func()")).Return(mockConn)
		mockConn.On("Close").Return(nil).Once()

		hostMap := NewDefaultHostMap(ctx, factory).(*defaultHostMap)

		id := hostMap.Add(mockWebSocketConn)

		hostMap.Remove(id)
		hostMap.Remove(id)

		mockConn.AssertExpectations(t)
		factory.AssertExpectations(t)
	})
}
