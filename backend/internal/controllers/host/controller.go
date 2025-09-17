package host

import (
	"errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
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
	HostService       host.HostServiceInterface
	WebsocketCfg      config.WebsocketCfg
	ClientConnFactory clientconn.ClientConnFactory
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
	group.GET("metadata/:hostUuid/:resourceUuid/*pathToResource", c.GetResourceMetadata)
	group.GET("download/:hostUuid/:resourceUuid/*pathToResource", c.DownloadResource)
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
// Path: /api/v1/host/metadata/{hostUuid}/{resourceUuid}/path/to/resource.exe
func (c *Controller) GetResourceMetadata(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	clientConn := c.ClientConnFactory.NewClientConn(ws, clientconn.DefaultClientConnTimeout)
	defer clientConn.Close()

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	resourceID, resourceErr := uuid.Parse(ctx.Param("resourceUuid"))
	pathToResource := ctx.Param("pathToResource")
	if hostErr != nil || resourceErr != nil {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	resp, err := c.HostService.GetResourceMetadata(hostID, resourceID, pathToResource)
	if err != nil {
		if errors.Is(err, &ws_errors.WebsocketError{}) {
			clientConn.SendAndLogError(message_types.Error.Binary(), err.(ws_errors.WebsocketError).Code().Binary())
			return
		}

		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.UnknownError.Binary())
		return
	}

	clientConn.SendAndLogError(resp)
}

// DownloadResource
//
// Method: GET
// Path: /api/v1/host/download/{hostUuid}/{resourceUuid}/path/to/resource.exe
func (c *Controller) DownloadResource(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	clientConn := c.ClientConnFactory.NewClientConn(ws, clientconn.DefaultClientConnTimeout)
	defer clientConn.Close()

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	resourceID, resourceErr := uuid.Parse(ctx.Param("resourceUuid"))
	pathToResource := ctx.Param("pathToResource")
	if hostErr != nil || resourceErr != nil {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	err = c.HostService.DownloadResource(clientConn, hostID, resourceID, pathToResource)
	if err != nil {
		if errors.Is(err, &ws_errors.WebsocketError{}) {
			clientConn.SendAndLogError(message_types.Error.Binary(), err.(ws_errors.WebsocketError).Code().Binary())
			return
		}

		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.UnknownError.Binary())
		return
	}
}

func (c *Controller) upgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  c.WebsocketCfg.BatchSize,
		WriteBufferSize: c.WebsocketCfg.BatchSize,
		// TODO: Allow all origins; in production, you should check the origin
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
}
