package host

import (
	"errors"
	"log"
	"net/http"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const hostKeyHeaderKey = "host-key"

type Controller struct {
	HostService       host.HostService
	WebsocketCfg      config.WebsocketCfg
	ClientConnFactory clientconn.ClientConnFactory
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
	group.GET(":hostUuid/:resourceUuid/metadata", c.GetResourceMetadata)
	group.GET(":hostUuid/:resourceUuid/download", c.DownloadResource)
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

	err = c.HostService.InitNewHostConnection(ctx.Request.Context(), ws)
	if err != nil {
		if errors.Is(err, &ws_errors.WebsocketError{}) {
			errorMsg := message_types.Error.Binary()
			errorMsg = append(errorMsg, err.(ws_errors.WebsocketError).Code().Binary()...)
			err = ws.WriteMessage(websocket.BinaryMessage, errorMsg)
			if err != nil {
				log.Println("Failed to write Invalid Url Params message:", err)
			}

			_ = ws.Close()
			return
		}

		log.Printf("Error during initialisation of a new connection: %v\n", err)
	}
}

// HostReconnect
//
// Method: GET
// Path: /api/v1/host/reconnect/{hostUuid}
// Required header: host-key
func (c *Controller) HostReconnect(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	hostKey := ctx.GetHeader(hostKeyHeaderKey)
	if len(hostKey) == 0 {
		errorMsg := message_types.Error.Binary()
		errorMsg = append(errorMsg, ws_errors.MissingRequiredHeaders.Binary()...)
		err = ws.WriteMessage(websocket.BinaryMessage, errorMsg)
		if err != nil {
			log.Println("Failed to write Missing Required Header message:", err)
		}

		_ = ws.Close()
		return
	}

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	if hostErr != nil {
		errorMsg := message_types.Error.Binary()
		errorMsg = append(errorMsg, ws_errors.InvalidUrlParams.Binary()...)
		err = ws.WriteMessage(websocket.BinaryMessage, errorMsg)
		if err != nil {
			log.Println("Failed to write Invalid Url Params message:", err)
		}

		_ = ws.Close()
		return
	}

	err = c.HostService.InitExistingHostConnection(ctx.Request.Context(), ws, hostID, hostKey)
	if err != nil {
		if errors.Is(err, &ws_errors.WebsocketError{}) {
			errorMsg := message_types.Error.Binary()
			errorMsg = append(errorMsg, err.(ws_errors.WebsocketError).Code().Binary()...)
			err = ws.WriteMessage(websocket.BinaryMessage, errorMsg)
			if err != nil {
				log.Println("Failed to write Invalid Url Params message:", err)
			}

			_ = ws.Close()
			return
		}

		log.Printf("Error during initialisation of an existing connection: %v\n", err)
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

	clientConn := c.ClientConnFactory.NewClientConn(ws, clientconn.DefaultClientConnTimeout)
	defer clientConn.Close()

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	resourceID, resourceErr := uuid.Parse(ctx.Param("resourceUuid"))
	if hostErr != nil || resourceErr != nil {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	resp, err := c.HostService.GetResourceMetadata(hostID, resourceID)
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
// Path: /api/v1/host/{hostUuid}/{resourceUuid}/download
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
	if hostErr != nil || resourceErr != nil {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	err = c.HostService.DownloadResource(clientConn, hostID, resourceID)
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
