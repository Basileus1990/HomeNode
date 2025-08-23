package host

import (
	"bytes"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_consts"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
)

type HostService interface {
	InitialiseNewHostConnection(id uuid.UUID) error
	GetResourceMetadata(hostUuid, resourceUuid uuid.UUID) ([]byte, error)
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
		return ws_errors.ConnectionClosedErr
	}

	query := helpers.UUIDToBinary(id)

	response, err := hostConn.Query(ws_consts.ServerSendUuid.Binary(), query)
	if err != nil {
		hostConn.Close()
		return fmt.Errorf("error on quering newly connected host: %w", err)
	}

	if !bytes.Equal(response, ws_consts.HostResponseOK.Binary()) {
		hostConn.Close()
		return fmt.Errorf("unexpected first response from host %s: %q", id.String(), response)
	}

	return nil
}

func (cs *defaultConnectionService) GetResourceMetadata(hostUuid, resourceUuid uuid.UUID) ([]byte, error) {
	hostConn, ok := cs.hostMap.Get(hostUuid)
	if !ok {
		return nil, ws_errors.HostNotFoundErr
	}

	query := helpers.UUIDToBinary(resourceUuid)

	response, err := hostConn.Query(ws_consts.ServerQueryResourceMetadata.Binary(), query)
	if err != nil {
		return nil, err
	}

	return response, nil
}
