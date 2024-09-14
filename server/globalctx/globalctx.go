package globalctx

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/server/models"
	"github.com/Basileus1990/EasyFileTransfer.git/server/wsconn"
)

// Those constants represent global dependencies kept in every request context

const (
	UserMapKey             = "user"
	HostMapKey             = "host"
	WSConnectionCreatorKey = "ws-conn-creator"
)

// This file contains helper functions for getting the dependencies from the context

// GetUserMap returns pointer to the models.UserMap map from context
func GetUserMap(ctx context.Context) *models.UserMap {
	return ctx.Value(UserMapKey).(*models.UserMap)
}

// GetHostMap returns pointer to the models.HostMap map from context
func GetHostMap(ctx context.Context) *models.HostMap {
	return ctx.Value(HostMapKey).(*models.HostMap)
}

// GetWSConnectionCreator returns wsconn.WSConnectionCreator from context
func GetWSConnectionCreator(ctx context.Context) wsconn.WSConnectionCreator {
	return ctx.Value(WSConnectionCreatorKey).(wsconn.WSConnectionCreator)
}
