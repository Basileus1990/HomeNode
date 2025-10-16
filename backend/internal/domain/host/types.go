package host

import (
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
)

const (
	uploadIdSize = 4
)

type hostStreamInitResponseDto struct {
	msgType  message_types.WebsocketMessageType
	streamId uint32
	payload  []byte
}

func newHostStreamInitResponseDto(resp []byte) (hostStreamInitResponseDto, error) {
	if len(resp) < message_types.WebsocketMessageTypeSize+uploadIdSize {
		return hostStreamInitResponseDto{}, ws_errors.InvalidMessageBodyErr
	}

	hostResp := hostStreamInitResponseDto{
		msgType:  message_types.WebsocketMessageType(helpers.BinaryToUint16(resp[:message_types.WebsocketMessageTypeSize])),
		streamId: helpers.BinaryToUint32(resp[message_types.WebsocketMessageTypeSize : message_types.WebsocketMessageTypeSize+uploadIdSize]),
		payload:  resp[message_types.WebsocketMessageTypeSize+uploadIdSize:],
	}

	return hostResp, nil
}

type msgTypeWithPayload struct {
	msgType message_types.WebsocketMessageType
	payload []byte
}

func newMsgTypeWithPayloadDto(req []byte) (msgTypeWithPayload, error) {
	if len(req) < message_types.WebsocketMessageTypeSize {
		return msgTypeWithPayload{}, ws_errors.InvalidMessageBodyErr
	}

	clientReq := msgTypeWithPayload{
		msgType: message_types.WebsocketMessageType(helpers.BinaryToUint16(req[:message_types.WebsocketMessageTypeSize])),
		payload: req[message_types.WebsocketMessageTypeSize:],
	}

	return clientReq, nil
}
