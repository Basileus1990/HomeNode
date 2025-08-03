package controllers

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

type pingResponse struct {
	Message string `json:"message"`
}

type PingController struct{}

func (p *PingController) SetUpRoutes(group *gin.RouterGroup) {
	group.Handle(http.MethodGet, "ping", p.Ping)
}

func (p *PingController) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, pingResponse{Message: "Pong :)"})
}
