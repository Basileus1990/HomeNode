package main

import (
	"github.com/Basileus1990/EasyFileTransfer.git/server/controllers"
	"net/http"
)

func getRoutes() http.Handler {
	mux := http.NewServeMux()

	// websocket endpoints
	//mux.Handle("/host")

	// http endpoints
	mux.HandleFunc("/ping", controllers.Ping)
	return withMiddlewares(mux)
}

func withMiddlewares(handler http.Handler) http.Handler {
	return handler
}
