package main

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/server/globalctx"
	"github.com/Basileus1990/EasyFileTransfer.git/server/middlewares"
	"github.com/Basileus1990/EasyFileTransfer.git/server/models"
	"log"
	"net/http"
)

// TODO Global

func main() {
	fmt.Println("Starting the server ...")

	mux := getRoutes()
	mux = middlewares.NewDependencyInjector(mux, map[string]any{
		globalctx.USER_MAP: models.NewUserMap(),
		globalctx.HOST_MAP: models.NewHostMap(),
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
