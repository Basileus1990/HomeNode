package main

import (
	"fmt"
	"net/http"

	"github.com/google/uuid"
)

// TODO Global
// - create
// - Add uuid system

func main() {
	fmt.Println("Starting the server ...")

	server := http.Server{
		Addr: "localhost:3000",
	}

	server.Handler()
	uuid.New()
}
