package controllers

import (
	"github.com/Basileus1990/EasyFileTransfer.git/src/common/hostconn"
	"github.com/gin-gonic/gin"
	"net/http"
)

type PingController interface {
	Ping(c *gin.Context)
}

type DefaultPingController struct{}

func (dpc DefaultPingController) Ping(c *gin.Context) {
	result := GlobalConn.Query(hostconn.Message{
		Content: []byte("test"),
	})
	println(string(result.Content))
	c.JSON(http.StatusOK, "Pong :)")
}
