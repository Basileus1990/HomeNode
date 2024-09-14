package routing

import (
	"github.com/Basileus1990/EasyFileTransfer.git/src/controllers"
	"github.com/gin-gonic/gin"
	"net/http"
)

func setUpPing(router *gin.RouterGroup) {
	pc := controllers.DefaultPingController{}

	router.Handle(http.MethodGet, "ping", pc.Ping)
}
