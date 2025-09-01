package hostconn

import (
	"github.com/stretchr/testify/mock"
	"time"
)

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
