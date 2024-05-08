package controllers

import (
	"net/http"
)

func Ping(w http.ResponseWriter, r *http.Request) {
	_, err := w.Write([]byte("Pong :)"))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	}
	
	w.WriteHeader(http.StatusOK)
}
