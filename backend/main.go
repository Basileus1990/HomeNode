package main

import (
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/config"
	"github.com/Basileus1990/EasyFileTransfer.git/routing"
	"log"
)

func main() {
	fmt.Println("Starting the server ...")

	cfgErr := config.LoadConfig()
	if cfgErr != nil {
		panic(cfgErr)
	}

	engine := routing.SetUpRoutes()
	serverAddress := fmt.Sprintf("localhost:%d", config.Get().Server.Port)

	err := engine.Run(serverAddress)
	if err != nil {
		log.Fatal("Exited the server with an error: ", err)
	}
}
