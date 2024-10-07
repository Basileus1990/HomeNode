package routing

import (
	"github.com/Basileus1990/EasyFileTransfer.git/src/controllers"
	"github.com/gin-gonic/gin"
)

func SetUpRoutes() *gin.Engine {
	router := gin.Default()
	router.GET("/ws", controllers.TestWS)

	api := router.Group("api")

	v1 := api.Group("v1")
	setUpPing(v1)

	return router
}
