package saved_connections_repository

import "github.com/google/uuid"

type SavedConnection struct {
	Id      uuid.UUID
	KeyHash string
}
