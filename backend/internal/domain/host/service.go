package host

import (
	"bytes"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
)

type HostServiceInterface interface {
	InitialiseNewHostConnection(id uuid.UUID) error
	GetResourceMetadata(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) ([]byte, error)
	DownloadResource(clientConn clientconn.ClientConn, hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) error
}

type HostService struct {
	hostMap         hostmap.HostMap
	websocketConfig config.WebsocketCfg
}

func NewHostService(hostMap hostmap.HostMap, websocketCfg config.WebsocketCfg) HostServiceInterface {
	return &HostService{
		hostMap:         hostMap,
		websocketConfig: websocketCfg,
	}
}

func (s *HostService) InitialiseNewHostConnection(id uuid.UUID) error {
	hostConn, ok := s.hostMap.Get(id)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	query := helpers.UUIDToBinary(id)

	response, err := hostConn.Query(message_types.InitWithUuidQuery.Binary(), query)
	if err != nil {
		hostConn.Close()
		return fmt.Errorf("error on quering newly connected host: %w", err)
	}

	if !bytes.Equal(response, message_types.ACK.Binary()) {
		hostConn.Close()
		return fmt.Errorf("unexpected first response from host %s: %q", id.String(), response)
	}

	return nil
}

func (s *HostService) GetResourceMetadata(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) ([]byte, error) {
	hostConn, ok := s.hostMap.Get(hostUuid)
	if !ok {
		return nil, ws_errors.HostNotFoundErr
	}

	pathToResourceBinary := []byte(helpers.AddNullCharToString(pathToResource))

	response, err := hostConn.Query(
		message_types.MetadataQuery.Binary(),
		helpers.UUIDToBinary(resourceUuid),
		pathToResourceBinary,
	)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *HostService) DownloadResource(
	clientConn clientconn.ClientConn,
	hostUUID uuid.UUID,
	resourceUUID uuid.UUID,
	pathToResource string,
) error {
	hostConn, ok := s.hostMap.Get(hostUUID)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	downloadInitResp, err := hostConn.Query(
		message_types.DownloadInitRequest.Binary(),
		helpers.UUIDToBinary(resourceUUID),
		helpers.Uint32ToBinary(uint32(s.websocketConfig.BatchSize)),
		[]byte(helpers.AddNullCharToString(pathToResource)),
	)
	if err != nil {
		return err
	}

	msgType, err := message_types.GetMsgType(downloadInitResp)
	if err != nil {
		return err
	}

	if msgType == message_types.Error {
		return clientConn.Send(downloadInitResp)
	}

	downloadInitRespDto, err := newHostDownloadInitResponseDto(downloadInitResp)
	if err != nil {
		return err
	}

	err = clientConn.Send(
		message_types.DownloadInitResponse.Binary(),
		helpers.Uint32ToBinary(uint32(s.websocketConfig.BatchSize)),
		downloadInitRespDto.payload,
	)
	if err != nil {
		_ = s.sendDownloadCompletionQueryToHost(hostConn, downloadInitRespDto.downloadId)
		return err
	}

	return s.handleDownloadLoop(hostConn, clientConn, downloadInitRespDto.downloadId)
}

func (s *HostService) handleDownloadLoop(
	hostConn hostconn.HostConn,
	clientConn clientconn.ClientConn,
	downloadId uint32,
) (err error) {
	defer func() {
		if err != nil {
			_ = s.sendDownloadCompletionQueryToHost(hostConn, downloadId)
		}
	}()

	for {
		clientRequest, err := clientConn.Listen()
		if err != nil {
			return err
		}

		chunkReqDto, err := newClientChunkRequestDto(clientRequest)
		if err != nil {
			return err
		}

		switch chunkReqDto.msgType {
		case message_types.DownloadCompletionRequest:
			return s.sendDownloadCompletionQueryToHost(hostConn, downloadId)
		case message_types.ChunkRequest:
			err = s.handleChunkRequest(hostConn, clientConn, downloadId, chunkReqDto)
			if err != nil {
				return err
			}
		default:
			return ws_errors.UnexpectedMessageTypeErr
		}
	}
}

func (s *HostService) sendDownloadCompletionQueryToHost(hostConn hostconn.HostConn, downloadId uint32) error {
	_, err := hostConn.Query(
		message_types.DownloadCompletionRequest.Binary(),
		helpers.Uint32ToBinary(downloadId),
	)
	return err
}

func (s *HostService) handleChunkRequest(
	hostConn hostconn.HostConn,
	clientConn clientconn.ClientConn,
	downloadId uint32,
	chunkReqDto clientChunkRequestDto,
) error {
	hostResp, err := hostConn.Query(
		message_types.ChunkRequest.Binary(),
		helpers.Uint32ToBinary(downloadId),
		chunkReqDto.payload,
	)
	if err != nil {
		return err
	}

	return clientConn.Send(hostResp)
}
