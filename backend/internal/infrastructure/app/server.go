package app

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/cont"
	"github.com/gin-gonic/gin"
)

type Server struct {
	container cont.Container
	engine    *gin.Engine
}

func NewServer() (*Server, error) {
	var server Server

	container, err := cont.NewContainer()
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

	pingController := controllers.PingController{}
	pingController.SetUpRoutes(v1)

	return router
}
