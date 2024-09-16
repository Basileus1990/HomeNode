package routing

import (
	"github.com/gin-gonic/gin"
)

func SetUpRoutes() *gin.Engine {
	engine := gin.Default()
	api := engine.Group("api")

	v1 := api.Group("v1")
	setUpPing(v1)

	return engine
}
