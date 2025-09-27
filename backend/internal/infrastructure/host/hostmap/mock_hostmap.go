package hostmap

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/mock"
)

type MockHostMap struct {
	mock.Mock
}

func (m *MockHostMap) AddNew(conn *websocket.Conn) uuid.UUID {
	args := m.Called(conn)
	return args.Get(0).(uuid.UUID)
}

func (m *MockHostMap) Remove(id uuid.UUID) {
	m.Called(id)
}

func (m *MockHostMap) Get(id uuid.UUID) (hostconn.HostConn, bool) {
	args := m.Called(id)
	var c hostconn.HostConn
	if args.Get(0) != nil {
		c = args.Get(0).(hostconn.HostConn)
	}
	return c, args.Bool(1)
}
