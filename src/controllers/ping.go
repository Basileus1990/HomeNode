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
	c.JSON(http.StatusOK, "Pong :)")
}
