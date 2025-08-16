package msgtype

import "github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"

type WebsocketMessage uint16

func (t WebsocketMessage) Binary() []byte {
	return helpers.Uint16ToBinary(uint16(t))
}

// From server to host
const (
	ServerSendUuid WebsocketMessage = 1
)

// From host to server
const (
	HostResponseOK WebsocketMessage = 1000
)
