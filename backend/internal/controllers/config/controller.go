package config

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/gin-gonic/gin"
	"net/http"
)

type Controller struct {
	FrontendConfig config.FrontendCfg
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("", c.GetConfig)
}

// GetConfig
//
// Method: GET
// Path: /api/v1/config/
func (c *Controller) GetConfig(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, c.FrontendConfig)
}
