package host

import (
	"bytes"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/msgtype"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
)

type HostService interface {
	InitialiseNewHostConnection(id uuid.UUID) error
}

type defaultConnectionService struct {
	hostMap hostmap.HostMap
}

func NewHostService(hostMap hostmap.HostMap) HostService {
	return &defaultConnectionService{
		hostMap: hostMap,
	}
}

func (cs *defaultConnectionService) InitialiseNewHostConnection(id uuid.UUID) error {
	hostConn, ok := cs.hostMap.Get(id)
	if !ok {
		return fmt.Errorf("newly created host not found with id: %s", id.String())
	}

	payload := id[:]

	response, err := hostConn.Query(msgtype.ServerSendUuid.Binary(), payload)
	if err != nil {
		hostConn.Close()
		return fmt.Errorf("error on quering newly connected host: %w", err)
	}

	if !bytes.Equal(response, msgtype.HostResponseOK.Binary()) {
		hostConn.Close()
		return fmt.Errorf("unexpected first response from host %s: %q", id.String(), response)
	}

	return nil
}
