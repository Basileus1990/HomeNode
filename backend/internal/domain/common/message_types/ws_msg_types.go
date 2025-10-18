package message_types

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
)

const WebsocketMessageTypeSize = 2

type WebsocketMessageType uint16

func (t WebsocketMessageType) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(t))
}

const (
	Error                      WebsocketMessageType = 0
	ACK                        WebsocketMessageType = 1
	InitWithUuidQuery          WebsocketMessageType = 2
	MetadataQuery              WebsocketMessageType = 3
	MetadataResponse           WebsocketMessageType = 4
	DownloadInitRequest        WebsocketMessageType = 5
	DownloadInitResponse       WebsocketMessageType = 6
	ChunkRequest               WebsocketMessageType = 7
	ChunkResponse              WebsocketMessageType = 8
	EofResponse                WebsocketMessageType = 9
	DownloadCompletionRequest  WebsocketMessageType = 10
	InitExistingHost           WebsocketMessageType = 11
	CreateDirectory            WebsocketMessageType = 12
	DeleteResource             WebsocketMessageType = 13
	CreateFileInitRequest      WebsocketMessageType = 14
	CreateFileInitResponse     WebsocketMessageType = 15
	CreateFileStreamEnd        WebsocketMessageType = 16
	CreateFileHostChunkRequest WebsocketMessageType = 17
)

func GetMsgType(msg []byte) (WebsocketMessageType, error) {
	if len(msg) < WebsocketMessageTypeSize {
		return 0, ws_errors.InvalidMessageBodyErr
	}

	return WebsocketMessageType(helpers.BinaryToUint16(msg[:WebsocketMessageTypeSize])), nil
}
