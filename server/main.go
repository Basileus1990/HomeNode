package main

import (
	"fmt"
	"log"
	"net/http"
)

// TODO Global
// - create
// - Add uuid system

func main() {
	fmt.Println("Starting the server ...")

	mux := getRoutes()
	server := http.Server{
		Addr:    "localhost:3000",
		Handler: mux,
	}

	err := server.ListenAndServe()
	if err != nil {
		log.Fatal("Exited the server with an error: ", err)
	}
}
