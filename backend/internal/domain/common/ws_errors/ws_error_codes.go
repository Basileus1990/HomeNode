package ws_errors

import "github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"

type WebsocketErrorCode uint16

func (c WebsocketErrorCode) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(c))
}

const (
	ConnectionClosed WebsocketErrorCode = 0
	HostNotFound     WebsocketErrorCode = 1
	QueryTimeout     WebsocketErrorCode = 2
	InvalidUrlParams WebsocketErrorCode = 3
	UnknownError     WebsocketErrorCode = 4
)
