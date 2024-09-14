package routing

import (
	"github.com/Basileus1990/EasyFileTransfer.git/server/controllers"
	"net/http"
)

func GetRoutes() http.Handler {
	mux := http.NewServeMux()

	// websocket endpoints
	//mux.Handle("/host")

	// http endpoints
	mux.HandleFunc("/ping", controllers.Ping)
	return mux
}
