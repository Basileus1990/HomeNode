package ws_consts

import "github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"

const WebsocketMessageTypeSize = 2

type WebsocketMessageType uint16

func (t WebsocketMessageType) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(t))
}

// Query types
const (
	ServerSendUuid              WebsocketMessageType = 0
	ServerQueryResourceMetadata WebsocketMessageType = 1
)

// Response types
const (
	HostResponseOK    WebsocketMessageType = 1000
	HostResponseError WebsocketMessageType = 1001
)
