package clientconn

import "github.com/stretchr/testify/mock"

type MockClientConn struct {
	mock.Mock
}

func (m *MockClientConn) Send(payload ...[]byte) error {
	args := m.Called(payload)
	return args.Error(0)
}

func (m *MockClientConn) SendAndLogError(payload ...[]byte) {
	m.Called(payload)
}

func (m *MockClientConn) Listen() ([]byte, error) {
	args := m.Called()
	var b []byte
	if args.Get(0) != nil {
		b = args.Get(0).([]byte)
	}
	return b, args.Error(1)
}

func (m *MockClientConn) Close() {
	m.Called()
}
