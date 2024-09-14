package main

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/server/config"
	"github.com/Basileus1990/EasyFileTransfer.git/server/globalctx"
	"github.com/Basileus1990/EasyFileTransfer.git/server/middlewares"
	"github.com/Basileus1990/EasyFileTransfer.git/server/models"
	"github.com/Basileus1990/EasyFileTransfer.git/server/wsconn"
	"log"
	"net/http"
)

func main() {
	fmt.Println("Starting the server ...")

	cfgErr := config.LoadConfig()
	if cfgErr != nil {
		panic(cfgErr)
	}

	mux := getRoutes()
	mux = middlewares.NewDependencyInjector(mux, map[string]any{
		globalctx.UserMapKey:             models.NewUserMap(),
		globalctx.HostMapKey:             models.NewHostMap(),
		globalctx.WSConnectionCreatorKey: wsconn.NewWSConnectionCreator(),
	})

	server := http.Server{
		Addr:    "localhost:3000",
		Handler: mux,
	}

	err := server.ListenAndServe()
	if err != nil {
		log.Fatal("Exited the server with an error: ", err)
	}
}
