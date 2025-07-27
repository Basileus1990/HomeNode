package routing

import (
	"github.com/gin-gonic/gin"
)

func SetUpRoutes() *gin.Engine {
	router := gin.Default()

	api := router.Group("api")

	v1 := api.Group("v1")
	setUpPing(v1)

	return router
}
