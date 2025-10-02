package saved_connections_repository

import (
	"context"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockSavedConnectionsRepository struct {
	mock.Mock
}

func (m *MockSavedConnectionsRepository) GetById(ctx context.Context, id uuid.UUID) (*SavedConnection, error) {
	args := m.Called(ctx, id)
	if sc, ok := args.Get(0).(*SavedConnection); ok {
		return sc, args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockSavedConnectionsRepository) AddOrRenew(ctx context.Context, sc SavedConnection) error {
	args := m.Called(ctx, sc)
	return args.Error(0)
}
