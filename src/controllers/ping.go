package controllers

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

type PingController interface {
	Ping(c *gin.Context)
}

type DefaultPingController struct{}

func (dpc DefaultPingController) Ping(c *gin.Context) {
	result, err := GlobalConn.Query([]byte("test"))
	println(string(result))
	if err != nil {
		println(err.Error())
	}
	c.JSON(http.StatusOK, "Pong :)")
}
