package main

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app"
	"log"
)

func main() {
	fmt.Println("Starting the app ...")

	server, err := app.NewServer()
	if err != nil {
		log.Fatalf("Failed to create the server with error: %v", err)
	}

	if err = server.ListenAndServe(); err != nil {
		log.Fatal("Exited the app with an error: ", err)
	}

	// TODO: Add a graceful shutdown
	fmt.Println("Exited successfully")
}
