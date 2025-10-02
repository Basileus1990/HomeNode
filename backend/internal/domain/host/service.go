package host

import (
	"bytes"
	"context"
	"fmt"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host/saved_connections_repository"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/app/config"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/client/clientconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostmap"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type HostService interface {
	InitNewHostConnection(ctx context.Context, ws *websocket.Conn) error
	InitExistingHostConnection(ctx context.Context, ws *websocket.Conn, hostId uuid.UUID, hostKey string) error
	GetResourceMetadata(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) ([]byte, error)
	DownloadResource(clientConn clientconn.ClientConn, hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) error
}

type defaultConnectionService struct {
	hostMap                    hostmap.HostMap
	websocketConfig            config.WebsocketCfg
	savedConnectionsRepository saved_connections_repository.SavedConnectionsRepositoryInterface
}

func NewHostService(
	hostMap hostmap.HostMap,
	websocketCfg config.WebsocketCfg,
	savedConnectionsRepository saved_connections_repository.SavedConnectionsRepositoryInterface,
) HostService {
	return &defaultConnectionService{
		hostMap:                    hostMap,
		websocketConfig:            websocketCfg,
		savedConnectionsRepository: savedConnectionsRepository,
	}
}

func (s *defaultConnectionService) InitNewHostConnection(ctx context.Context, ws *websocket.Conn) error {
	hostId := s.hostMap.AddNew(ws)
	hostConn, ok := s.hostMap.Get(hostId)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	hostKey := helpers.GetRandomKey()
	keyHash := helpers.HashString(hostKey)

	response, err := hostConn.Query(
		message_types.InitWithUuidQuery.Binary(),
		helpers.UUIDToBinary(hostId),
		[]byte(helpers.AddNullCharToString(hostKey)),
	)
	if err != nil {
		hostConn.Close()
		return fmt.Errorf("error on quering newly connected host: %w", err)
	}

	if !bytes.Equal(response, message_types.ACK.Binary()) {
		hostConn.Close()
		return fmt.Errorf("unexpected first response from host %s: %q", hostId.String(), response)
	}

	err = s.savedConnectionsRepository.AddOrRenew(ctx, saved_connections_repository.SavedConnection{
		Id:      hostId,
		KeyHash: keyHash,
	})
	if err != nil {
		hostConn.Close()
		return err
	}

	return nil
}

func (s *defaultConnectionService) InitExistingHostConnection(
	ctx context.Context,
	ws *websocket.Conn,
	hostId uuid.UUID,
	hostKey string,
) error {
	_, ok := s.hostMap.Get(hostId)
	if ok {
		return ws_errors.HostAlreadyConnectedErr
	}

	savedConnection, err := s.savedConnectionsRepository.GetById(ctx, hostId)
	if err != nil {
		return err
	}

	keyHash := helpers.HashString(hostKey)
	if savedConnection != nil && savedConnection.KeyHash != keyHash {
		return ws_errors.InvalidHostKeyErr
	}

	err = s.hostMap.Add(ws, hostId)
	if err != nil {
		return err
	}

	hostConn, ok := s.hostMap.Get(hostId)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	response, err := hostConn.Query(
		message_types.InitExistingHost.Binary(),
	)
	if err != nil {
		hostConn.Close()
		return fmt.Errorf("error on quering newly connected host: %w", err)
	}

	if !bytes.Equal(response, message_types.ACK.Binary()) {
		hostConn.Close()
		return fmt.Errorf("unexpected first response from host %s: %q", hostId.String(), response)
	}

	err = s.savedConnectionsRepository.AddOrRenew(ctx, saved_connections_repository.SavedConnection{
		Id:      hostId,
		KeyHash: keyHash,
	})
	if err != nil {
		hostConn.Close()
		return err
	}

	return nil
}

func (s *defaultConnectionService) GetResourceMetadata(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) ([]byte, error) {
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

func (s *defaultConnectionService) DownloadResource(
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

func (s *defaultConnectionService) handleDownloadLoop(
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

func (s *defaultConnectionService) sendDownloadCompletionQueryToHost(hostConn hostconn.HostConn, downloadId uint32) error {
	_, err := hostConn.Query(
		message_types.DownloadCompletionRequest.Binary(),
		helpers.Uint32ToBinary(downloadId),
	)
	return err
}

func (s *defaultConnectionService) handleChunkRequest(
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
