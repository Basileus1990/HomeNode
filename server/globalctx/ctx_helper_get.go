package globalctx

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/server/models"
)

// This file contains helper functions for getting the dependencies from the context

// GetUserMap Returns pointer to the user map from context
func GetUserMap(ctx context.Context) *models.UserMap {
	return ctx.Value(UserMapKey).(*models.UserMap)
}

// GetHostMap Returns pointer to the host map from context
func GetHostMap(ctx context.Context) *models.HostMap {
	return ctx.Value(HostMapKey).(*models.HostMap)
}
