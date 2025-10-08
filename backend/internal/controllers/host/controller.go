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

const hostKeyQueryParam = "hostKey"
const uploadNameQueryParam = "name"
const uploadTypeQueryParam = "type"

type Controller struct {
	HostService       host.HostService
	WebsocketCfg      config.WebsocketCfg
	ClientConnFactory clientconn.ClientConnFactory
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
	group.GET("reconnect/:hostUuid", c.HostReconnect)
	group.GET("metadata/:hostUuid/:resourceUuid/*pathToResource", c.GetResourceMetadata)
	group.GET("metadata/:hostUuid/:resourceUuid", c.GetResourceMetadata)
	group.GET("download/:hostUuid/:resourceUuid/*pathToResource", c.DownloadResource)
	group.GET("download/:hostUuid/:resourceUuid", c.DownloadResource)
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
		c.handleConnectionInitError(err, ws)
	}
}

// HostReconnect
//
// Method: GET
// Path: /api/v1/host/reconnect/{hostUuid}?hostKey={key}
func (c *Controller) HostReconnect(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	hostKey, ok := ctx.GetQuery(hostKeyQueryParam)
	if !ok || len(hostKey) == 0 {
		c.handleConnectionInitError(ws_errors.MissingRequiredParamsErr, ws)
	}

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	if hostErr != nil {
		c.handleConnectionInitError(ws_errors.InvalidUrlParamsErr, ws)
	}

	err = c.HostService.InitExistingHostConnection(ctx.Request.Context(), ws, hostID, hostKey)
	if err != nil {
		c.handleConnectionInitError(err, ws)
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

// UploadResource
//
// Method: GET
// Path: /api/v1/host/upload/{hostUuid}/{resourceUuid}/path/to/resource.exe?name={name}&type={type}
func (c *Controller) UploadResource(ctx *gin.Context) {
	upgrader := c.upgrader()

	ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	clientConn := c.ClientConnFactory.NewClientConn(ws, clientconn.DefaultClientConnTimeout)
	defer clientConn.Close()

	uploadName, ok := ctx.GetQuery(uploadNameQueryParam)
	if !ok || len(uploadName) == 0 {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	uploadType, ok := ctx.GetQuery(uploadTypeQueryParam)
	if !ok || len(uploadType) == 0 || !(uploadType == "file" || uploadType == "dir") {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	hostID, hostErr := uuid.Parse(ctx.Param("hostUuid"))
	resourceID, resourceErr := uuid.Parse(ctx.Param("resourceUuid"))
	pathToResource := ctx.Param("pathToResource")
	if hostErr != nil || resourceErr != nil {
		clientConn.SendAndLogError(message_types.Error.Binary(), ws_errors.InvalidUrlParams.Binary())
		return
	}

	err = c.HostService.UploadResource(clientConn, hostID, resourceID, pathToResource)
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

func (c *Controller) handleConnectionInitError(err error, ws *websocket.Conn) {
	if errors.Is(err, &ws_errors.WebsocketError{}) {
		errorMsg := message_types.Error.Binary()
		errorMsg = append(errorMsg, err.(ws_errors.WebsocketError).Code().Binary()...)
		err = ws.WriteMessage(websocket.BinaryMessage, errorMsg)
		if err != nil {
			log.Printf("Failed to write %s message: %v\n", err.(ws_errors.WebsocketError).Error(), err)
		}

	}

	_ = ws.Close()
	log.Printf("Error during initialisation of a connection: %v\n", err)
}
