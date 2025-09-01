package ws_consts

import "github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"

const WebsocketMessageTypeSize = 2

type WebsocketMessageType uint16

func (t WebsocketMessageType) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(t))
}

const (
	Error             WebsocketMessageType = 0
	ACK               WebsocketMessageType = 1
	InitWithUuidQuery WebsocketMessageType = 2
	MetadataQuery     WebsocketMessageType = 3
)
