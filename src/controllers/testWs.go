package controllers

import (
	"github.com/Basileus1990/EasyFileTransfer.git/src/common/hostconn"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var GlobalConn hostconn.Conn

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func TestWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	GlobalConn = hostconn.NewHostConnection(conn)
}
