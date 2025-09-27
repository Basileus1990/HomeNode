package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/ping"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/appcontainer"
	"github.com/gin-gonic/gin"
)

const frontendBuildLocation = "../frontend/build/client/"

type Server struct {
	container *appcontainer.Container
	engine    *gin.Engine
}

func NewServer(ctx context.Context) (*Server, error) {
	var server Server

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
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	api := router.Group("api")

	v1 := api.Group("v1")

	pingController := ping.Controller{}
	pingController.SetUpRoutes(v1)

	configGroup := v1.Group("config")
	configController := config.Controller{FrontendConfig: s.container.Config.Frontend}
	configController.SetUpRoutes(configGroup)

	hostGroup := v1.Group("host")
	hostConnectController := host.Controller{
		HostMap:           s.container.HostMap,
		HostService:       s.container.HostService,
		WebsocketCfg:      s.container.Config.Websocket,
		ClientConnFactory: s.container.ClientConnFactory,
	}
	hostConnectController.SetUpRoutes(hostGroup)

	// Serving the frontend
	router.StaticFS("/assets", http.Dir(frontendBuildLocation+"assets"))
	router.StaticFile("/favicon.ico", frontendBuildLocation+"favicon.ico")
	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not Found"})
			return
		}

		c.File(frontendBuildLocation + "index.html")
	})

	return router
}
