package saved_connections_repository

import (
	"database/sql"
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/db"
	"github.com/google/uuid"
	"golang.org/x/net/context"
	"time"
)

type SavedConnectionsRepositoryInterface interface {
	GetById(ctx context.Context, id uuid.UUID) (*SavedConnection, error)
	AddOrRenew(ctx context.Context, sc SavedConnection) error
}

type SavedConnectionsRepository struct {
	database               db.SqlDatabaseInterface
	savedConnectionsConfig config.SavedConnectionsCfg
}

func NewSavedConnectionsRepository(database db.SqlDatabaseInterface, cfg config.SavedConnectionsCfg) SavedConnectionsRepositoryInterface {
	return &SavedConnectionsRepository{
		database:               database,
		savedConnectionsConfig: cfg,
	}
}

func (r *SavedConnectionsRepository) GetById(ctx context.Context, id uuid.UUID) (*SavedConnection, error) {
	now := time.Now()
	validTo := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).
		AddDate(0, 0, r.savedConnectionsConfig.ValidForInDays)

	query := `
        SELECT id, key_hash
        FROM saved_connections
        WHERE (
            id = $1
            AND created_at < $2
		)
        LIMIT 1;
    `

	row := r.database.QueryRowContext(ctx, query, id, validTo)

	var sc SavedConnection
	err := row.Scan(
		&sc.Id,
		&sc.KeyHash,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &sc, nil
}

func (r *SavedConnectionsRepository) AddOrRenew(ctx context.Context, sc SavedConnection) error {
	query := `
        INSERT INTO saved_connections (id, key_hash, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            created_at = CURRENT_TIMESTAMP
    `

	_, err := r.database.ExecContext(ctx, query,
		sc.Id,
		sc.KeyHash,
	)
	if err != nil {
		return err
	}

	return nil
}
