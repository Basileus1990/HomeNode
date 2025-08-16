package host

import (
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/msgtype"
	"github.com/stretchr/testify/require"
	"testing"
	"time"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// --- Mocks ---

// MockConn implements hostconn.Conn
type MockConn struct {
	mock.Mock
}

func (m *MockConn) Query(query ...[]byte) ([]byte, error) {
	args := m.Called(query)
	var b []byte
	if args.Get(0) != nil {
		b = args.Get(0).([]byte)
	}
	return b, args.Error(1)
}

func (m *MockConn) QueryWithTimeout(timeout time.Duration, query ...[]byte) ([]byte, error) {
	args := m.Called(query, timeout)
	var b []byte
	if args.Get(0) != nil {
		b = args.Get(0).([]byte)
	}
	return b, args.Error(1)
}

func (m *MockConn) Close() {
	m.Called()
}

// MockHostMap implements hostmap.HostMap
type MockHostMap struct {
	mock.Mock
}

func (m *MockHostMap) Add(conn *websocket.Conn) uuid.UUID {
	args := m.Called(conn)
	return args.Get(0).(uuid.UUID)
}

func (m *MockHostMap) Remove(id uuid.UUID) {
	m.Called(id)
}

func (m *MockHostMap) Get(id uuid.UUID) (hostconn.Conn, bool) {
	args := m.Called(id)
	var c hostconn.Conn
	if args.Get(0) != nil {
		c = args.Get(0).(hostconn.Conn)
	}
	return c, args.Bool(1)
}

// --- Tests ---

func TestInitialiseNewHostConnection(t *testing.T) {
	t.Run("success: host replies OK", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &MockHostMap{}
		mockConn := &MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)

		expectedQuery := [][]byte{msgtype.ServerSendUuid.Binary(), id[:]}
		mockConn.On("Query", expectedQuery).Return(msgtype.HostResponseOK.Binary(), nil)

		svc := NewHostService(mockHostMap)
		err := svc.InitialiseNewHostConnection(id)

		assert.NoError(t, err)
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})

	t.Run("error: host not found", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &MockHostMap{}

		mockHostMap.On("Get", id).Return(nil, false)

		svc := NewHostService(mockHostMap)
		err := svc.InitialiseNewHostConnection(id)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "newly created host not found with id")
		mockHostMap.AssertExpectations(t)
	})

	t.Run("error: query returns error", func(t *testing.T) {
		id := uuid.New()
		mockHostMap := &MockHostMap{}
		mockConn := &MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)

		expectedQuery := [][]byte{msgtype.ServerSendUuid.Binary(), id[:]}
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
		mockHostMap := &MockHostMap{}
		mockConn := &MockConn{}

		mockHostMap.On("Get", id).Return(mockConn, true)
		mockConn.On("Close").Return()

		expectedQuery := [][]byte{msgtype.ServerSendUuid.Binary(), id[:]}
		mockConn.On("Query", expectedQuery).Return([]byte("NO"), nil)

		svc := NewHostService(mockHostMap)
		err := svc.InitialiseNewHostConnection(id)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected first response from host")
		mockHostMap.AssertExpectations(t)
		mockConn.AssertExpectations(t)
	})
}
