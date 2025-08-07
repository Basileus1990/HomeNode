package hostconnect

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/gin-gonic/gin"
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
	hostConn, ok := c.HostMap.Get(hostId)
	if !ok {
		log.Printf("Newly created host not found with id: %v\n", hostId)
	}

	response, err := hostConn.Query(hostId[:])
	if err != nil {
		log.Printf("Error on quering newly connected host: %v", err)

		err = conn.Close()
		if err != nil {
			log.Printf("Error on closing newly connected host: %v", err)
		}
		return
	}

	if string(response) != expectedHostFirstResponse {
		log.Printf("Unexpeded first response from host: %s", string(response))
		err = hostConn.Close()
		if err != nil {
			log.Printf("Error on closing newly connected host: %v", err)
		}

		return
	}
}
