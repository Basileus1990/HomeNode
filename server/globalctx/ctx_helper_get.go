package globalctx

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/server/models"
)

// This file contains helper functions for getting the dependencies from the context

// UserMap Returns pointer to the user map from context
func UserMap(ctx context.Context) *models.UserMap {
	return ctx.Value(USER_MAP).(*models.UserMap)
}

// HostMap Returns pointer to the host map from context
func HostMap(ctx context.Context) *models.HostMap {
	return ctx.Value(HOST_MAP).(*models.HostMap)
}
