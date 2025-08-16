package host

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
)

type Controller struct {
	HostMap      hostmap.HostMap
	HostService  host.HostService
	WebsocketCfg config.WebsocketCfg
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
}

// HostConnect
//
// Method: GET
// Path: /api/v1/host/connect
func (c *Controller) HostConnect(ctx *gin.Context) {
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  c.WebsocketCfg.WebsocketBufferSize,
		WriteBufferSize: c.WebsocketCfg.WebsocketBufferSize,
		// TODO: Allow all origins; in production, you should check the origin
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	hostId := c.HostMap.Add(conn)

	err = c.HostService.InitialiseNewHostConnection(hostId)
	if err != nil {
		log.Printf("Error during initialisation of a new connection: %v\n", err)
	}
}
