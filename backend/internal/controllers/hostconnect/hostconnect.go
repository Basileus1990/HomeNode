package hostconnect

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
)

const expectedHostFirstResponse = "OK"

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// TODO: Allow all origins; in production, you should check the origin
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Controller struct {
	HostMap hostmap.HostMap
}

func (c *Controller) SetUpRoutes(group *gin.RouterGroup) {
	group.GET("connect", c.HostConnect)
}

// HostConnect
//
// Path: /api/v1/host/connect
func (c *Controller) HostConnect(ctx *gin.Context) {
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade to websocket:", err)
		return
	}

	hostId := c.HostMap.Add(conn)

	err = c.sendIdAndVerifyResponse(hostId)
	if err != nil {
		log.Printf("Error on sendIdAndVerifyResponse: %v\n", err)

		err = conn.Close()
		if err != nil {
			log.Printf("Error on closing newly connected host: %v\n", err)
		}
	}
}

func (c *Controller) sendIdAndVerifyResponse(id uuid.UUID) error {
	hostConn, ok := c.HostMap.Get(id)
	if !ok {
		return fmt.Errorf("newly created host not found with id: %v", id)
	}

	response, err := hostConn.Query(id[:])
	if err != nil {
		return fmt.Errorf("error on quering newly connected host: %v", err)
	}

	if string(response) != expectedHostFirstResponse {
		return fmt.Errorf("unexpeded first response from host: %s", string(response))
	}

	return nil
}
