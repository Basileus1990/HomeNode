package app

import (
	"context"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/host"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/controllers/ping"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/appcontainer"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
	"os"
	"strings"
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
	router.StaticFS("/assets", http.Dir("../frontend/build/client/assets"))
	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not Found"})
			return
		}

		log.Println(c.Request.URL.Path)
		entries, err := os.ReadDir("../")
		if err != nil {
			log.Fatalf("Failed to read directory: %v", err)
		}
		for _, entry := range entries {
			info, err := entry.Info()
			if err != nil {
				log.Printf("Failed to get info for %s: %v", entry.Name(), err)
				continue
			}

			// Print file or directory info
			if entry.IsDir() {
				fmt.Printf("[DIR]  %s\n", entry.Name())
			} else {
				fmt.Printf("[FILE] %s (%d bytes)\n", entry.Name(), info.Size())
			}
		}
		c.File("../frontend/build/client/index.html")
	})

	return router
}
