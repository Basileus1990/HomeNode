package host

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
)

const (
	downloadIdSize = 4
)

type hostDownloadInitResponseDto struct {
	msgType    message_types.WebsocketMessageType
	downloadId uint32
	payload    []byte
}

func newHostDownloadInitResponseDto(resp []byte) (hostDownloadInitResponseDto, error) {
	if len(resp) < message_types.WebsocketMessageTypeSize+downloadIdSize {
		return hostDownloadInitResponseDto{}, ws_errors.InvalidMessageBodyErr
	}

	hostResp := hostDownloadInitResponseDto{
		msgType:    message_types.WebsocketMessageType(helpers.BinaryToUint16(resp[:message_types.WebsocketMessageTypeSize])),
		downloadId: helpers.BinaryToUint32(resp[message_types.WebsocketMessageTypeSize : message_types.WebsocketMessageTypeSize+downloadIdSize]),
		payload:    resp[message_types.WebsocketMessageTypeSize+downloadIdSize:],
	}

	return hostResp, nil
}

type clientChunkRequestDto struct {
	msgType message_types.WebsocketMessageType
	payload []byte
}

func newClientChunkRequestDto(req []byte) (clientChunkRequestDto, error) {
	if len(req) < message_types.WebsocketMessageTypeSize {
		return clientChunkRequestDto{}, ws_errors.InvalidMessageBodyErr
	}

	clientReq := clientChunkRequestDto{
		msgType: message_types.WebsocketMessageType(helpers.BinaryToUint16(req[:message_types.WebsocketMessageTypeSize])),
		payload: req[message_types.WebsocketMessageTypeSize:],
	}

	return clientReq, nil
}
