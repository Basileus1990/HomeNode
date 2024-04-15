package main

import "net/http"

func getRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// websocket endpoints
	mux.Handle("/host")

	return mux
}
