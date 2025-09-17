package db

import (
	"context"
	"database/sql"

	"github.com/stretchr/testify/mock"
)

type MockSqlDatabase struct {
	mock.Mock
}

var _ SqlDatabaseInterface = (*MockSqlDatabase)(nil)

func (m *MockSqlDatabase) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	ret := m.Called(ctx, query, args)
	var r0 sql.Result
	if rf, ok := ret.Get(0).(func(context.Context, string, []any) sql.Result); ok {
		r0 = rf(ctx, query, args)
	} else if ret.Get(0) != nil {
		r0 = ret.Get(0).(sql.Result)
	}
	var r1 error
	if rf, ok := ret.Get(1).(func(context.Context, string, []any) error); ok {
		r1 = rf(ctx, query, args)
	} else {
		r1 = ret.Error(1)
	}
	return r0, r1
}

func (m *MockSqlDatabase) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ret := m.Called(ctx, query, args)
	var r0 *sql.Rows
	if ret.Get(0) != nil {
		r0 = ret.Get(0).(*sql.Rows)
	}
	return r0, ret.Error(1)
}

func (m *MockSqlDatabase) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	ret := m.Called(ctx, query, args)
	var r0 *sql.Row
	if ret.Get(0) != nil {
		r0 = ret.Get(0).(*sql.Row)
	}
	return r0
}

func (m *MockSqlDatabase) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	ret := m.Called(ctx, query)
	var r0 *sql.Stmt
	if ret.Get(0) != nil {
		r0 = ret.Get(0).(*sql.Stmt)
	}
	return r0, ret.Error(1)
}

func (m *MockSqlDatabase) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	ret := m.Called(ctx, opts)
	var r0 *sql.Tx
	if ret.Get(0) != nil {
		r0 = ret.Get(0).(*sql.Tx)
	}
	return r0, ret.Error(1)
}

func (m *MockSqlDatabase) PingContext(ctx context.Context) error {
	ret := m.Called(ctx)
	return ret.Error(0)
}

func (m *MockSqlDatabase) Close() error {
	ret := m.Called()
	return ret.Error(0)
}
