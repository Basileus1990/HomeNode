package ws_errors

import "github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"

type WebsocketErrorCode uint16

func (c WebsocketErrorCode) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(c))
}

const (
	UnknownError          WebsocketErrorCode = 0
	ConnectionClosed      WebsocketErrorCode = 1
	Timeout               WebsocketErrorCode = 2
	HostNotFound          WebsocketErrorCode = 3
	InvalidUrlParams      WebsocketErrorCode = 4
	InvalidMessageBody    WebsocketErrorCode = 5
	UnexpectedMessageType WebsocketErrorCode = 6
)
