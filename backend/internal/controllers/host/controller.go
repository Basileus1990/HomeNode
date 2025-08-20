package host

import (
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_consts"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
)

type Controller struct {
	HostMap           hostmap.HostMap
	HostService       host.HostService
	WebsocketCfg      config.WebsocketCfg
	ClientConnFactory clientconn.ClientConnFactory
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
	group.GET(":hostUuid/:resourceUuid/metadata", c.GetResourceMetadata)

}

// HostConnect
//
// Method: GET
// Path: /api/v1/host/connect
func (c *Controller) HostConnect(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	hostId := c.HostMap.Add(ws)

	err = c.HostService.InitialiseNewHostConnection(hostId)
	if err != nil {
		log.Printf("Error during initialisation of a new connection: %v\n", err)
	}
}

// GetResourceMetadata
//
// Method: GET
// Path: /api/v1/host/{hostUuid}/{resourceUuid}/metadata
func (c *Controller) GetResourceMetadata(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	clientConn := c.ClientConnFactory.NewClientConn(ws)
	defer clientConn.Close()

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	resourceID, resourceErr := uuid.Parse(ctx.Param("resourceUuid"))

	if hostErr != nil || resourceErr != nil {
		err = clientConn.Send(ws_consts.HostResponseError.Binary(), ws_errors.InvalidUrlParams.Binary())
		if err != nil {
			log.Printf("GetResourceMetadata ERROR send invalidUrlParams: %v\n", err)
			return
		}
	}

	resp, err := c.HostService.GetResourceMetadata(hostID, resourceID)
	if err != nil {
		if errors.Is(err, &ws_errors.WebsocketError{}) {
			err = clientConn.Send(ws_consts.HostResponseError.Binary(), err.(ws_errors.WebsocketError).Code().Binary())
			if err != nil {
				log.Printf("GetResourceMetadata ERROR send response error: %v\n", err)
				return
			}
		}
	}

	err = clientConn.Send(resp)
	if err != nil {
		log.Printf("GetResourceMetadata ERROR send response: %v\n", err)
		return
	}
}

func (c *Controller) upgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  c.WebsocketCfg.WebsocketBufferSize,
		WriteBufferSize: c.WebsocketCfg.WebsocketBufferSize,
		// TODO: Allow all origins; in production, you should check the origin
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
}
