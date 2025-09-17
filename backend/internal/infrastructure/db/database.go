package db

import (
	"context"
	"database/sql"
)

type SqlDatabaseInterface interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
	PingContext(ctx context.Context) error
	Close() error
}

type SqlDatabase struct {
	db *sql.DB
}

var _ SqlDatabaseInterface = &SqlDatabase{}

func NewSqlDatabase(driverName string, dataSourceName string) (SqlDatabaseInterface, error) {
	db, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}
	return &SqlDatabase{db: db}, err
}

func (s *SqlDatabase) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, query, args...)
}

func (s *SqlDatabase) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, query, args...)
}

func (s *SqlDatabase) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return s.db.QueryRowContext(ctx, query, args...)
}

func (s *SqlDatabase) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	return s.db.PrepareContext(ctx, query)
}

func (s *SqlDatabase) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return s.db.BeginTx(ctx, opts)
}

func (s *SqlDatabase) PingContext(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *SqlDatabase) Close() error {
	return s.db.Close()
}
