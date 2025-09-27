package main

import (
	"context"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app"
	_ "github.com/mattn/go-sqlite3"
	"log"
)

func main() {
	fmt.Println("Starting the app ...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server, err := app.NewServer(ctx)
	if err != nil {
		log.Fatalf("Failed to create the server with error: %v", err)
	}

	fmt.Print("\n####################\n")
	fmt.Print("## Server started ##\n")
	fmt.Print("####################\n\n")
	if err = server.ListenAndServe(); err != nil {
		log.Fatal("Exited the app with an error: ", err)
	}

	// TODO: AddNew a graceful shutdown
	fmt.Println("\nExited successfully")
}
