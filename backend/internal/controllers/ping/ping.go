package ping

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

type pingResponse struct {
	Message string `json:"message"`
}

type Controller struct{}

func (p *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.Handle(http.MethodGet, "ping", p.Ping)
}

func (p *Controller) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, pingResponse{Message: "Pong :)"})
}
