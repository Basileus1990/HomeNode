package app

import (
	"context"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/hostconnect"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/ping"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/appcontainer"
	"github.com/gin-gonic/gin"
)

type Server struct {
	container *appcontainer.Container
	engine    *gin.Engine
}

func NewServer() (*Server, error) {
	var server Server

	ctx := context.Background()

	container, err := appcontainer.NewContainer(ctx)
	if err != nil {
		return nil, err
	}
	server.container = container

	server.engine = server.setUpRoutes()

	return &server, nil
}

func (s *Server) ListenAndServe() error {
	return s.engine.Run(fmt.Sprintf(":%d", s.container.Config.Server.Port))
}

func (s *Server) setUpRoutes() *gin.Engine {
	router := gin.Default()

	api := router.Group("api")

	v1 := api.Group("v1")

	pingController := ping.Controller{}
	pingController.SetUpRoutes(v1)

	host := v1.Group("host")
	hostConnectController := hostconnect.Controller{
		HostMap: s.container.HostMap,
	}
	hostConnectController.SetUpRoutes(host)

	return router
}
