package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
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

func NewSqlDatabase(ctx context.Context, driverName string, dataSourceName string, migrationsPath string) (SqlDatabaseInterface, error) {
	directories := filepath.Dir(dataSourceName)
	err := os.MkdirAll(directories, 0755)
	if err != nil {
		return nil, err
	}

	db, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	dbConn := SqlDatabase{db: db}

	if !dbConn.databaseExists(dataSourceName) {
		err = dbConn.runMigrations(ctx, migrationsPath)
		if err != nil {
			return nil, err
		}
	}

	return &dbConn, nil
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

func (s *SqlDatabase) databaseExists(dataSourceName string) bool {
	// For sqlite we check if db file exists
	_, err := os.Stat(dataSourceName)
	return !os.IsNotExist(err)
}

func (s *SqlDatabase) runMigrations(ctx context.Context, migrationsPath string) error {
	log.Println("Running migrations")

	files, err := os.ReadDir(migrationsPath)
	if err != nil {
		return err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Name() < files[j].Name()
	})

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".sql") {
			err = s.runSingleMigration(ctx, file, migrationsPath)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *SqlDatabase) runSingleMigration(ctx context.Context, file os.DirEntry, migrationsPath string) error {
	sqlBytes, err := os.ReadFile(filepath.Join(migrationsPath, file.Name()))
	if err != nil {
		return err
	}

	query := string(sqlBytes)
	if _, err = s.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("error running migration %s: %w", file.Name(), err)
	}

	log.Println("Applied migration:", file.Name())
	return nil
}
