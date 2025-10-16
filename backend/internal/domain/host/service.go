package host

import (
	"bytes"
	"context"
	"fmt"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/host/saved_connections_repository"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
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
	CreateDirectory(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToDirectory string) ([]byte, error)
	DeleteResource(hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToResource string) ([]byte, error)
	CreateFile(clientConn clientconn.ClientConn, hostUuid uuid.UUID, resourceUuid uuid.UUID, pathToFile string, fileSize uint32) error
}

type defaultConnectionService struct {
	hostMap                    hostmap.HostMap
	savedConnectionsRepository saved_connections_repository.SavedConnectionsRepositoryInterface
}

func NewHostService(
	hostMap hostmap.HostMap,
	savedConnectionsRepository saved_connections_repository.SavedConnectionsRepositoryInterface,
) HostService {
	return &defaultConnectionService{
		hostMap:                    hostMap,
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
	return s.queryHostResource(hostUuid, resourceUuid, pathToResource, message_types.MetadataQuery)

}

func (s *defaultConnectionService) DownloadResource(
	clientConn clientconn.ClientConn,
	hostUuid uuid.UUID,
	resourceUuid uuid.UUID,
	pathToResource string,
) error {
	hostConn, ok := s.hostMap.Get(hostUuid)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	downloadInitResp, err := hostConn.Query(
		message_types.DownloadInitRequest.Binary(),
		helpers.UUIDToBinary(resourceUuid),
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

	downloadInitRespDto, err := newHostStreamInitResponseDto(downloadInitResp)
	if err != nil {
		return err
	}

	err = clientConn.Send(
		message_types.DownloadInitResponse.Binary(),
		downloadInitRespDto.payload,
	)
	if err != nil {
		_ = s.sendDownloadCompletionQueryToHost(hostConn, downloadInitRespDto.streamId)
		return err
	}

	return s.handleDownloadLoop(hostConn, clientConn, downloadInitRespDto.streamId)
}

func (s *defaultConnectionService) CreateDirectory(
	hostUuid uuid.UUID,
	resourceUuid uuid.UUID,
	pathToDirectory string,
) ([]byte, error) {
	return s.queryHostResource(hostUuid, resourceUuid, pathToDirectory, message_types.CreateDirectory)
}

func (s *defaultConnectionService) DeleteResource(
	hostUuid uuid.UUID,
	resourceUuid uuid.UUID,
	pathToResource string,
) ([]byte, error) {
	return s.queryHostResource(hostUuid, resourceUuid, pathToResource, message_types.DeleteResource)
}

func (s *defaultConnectionService) CreateFile(
	clientConn clientconn.ClientConn,
	hostUuid uuid.UUID,
	resourceUuid uuid.UUID,
	pathToFile string,
	fileSize uint32,
) error {
	hostConn, ok := s.hostMap.Get(hostUuid)
	if !ok {
		return ws_errors.HostNotFoundErr
	}

	// Request host to prepare for file creation with specified size and path
	createFileInitResp, err := hostConn.Query(
		message_types.CreateFileInitRequest.Binary(),
		helpers.UUIDToBinary(resourceUuid),
		helpers.Uint32ToBinary(fileSize),
		[]byte(helpers.AddNullCharToString(pathToFile)),
	)
	if err != nil {
		return err
	}

	msgType, err := message_types.GetMsgType(createFileInitResp)
	if err != nil {
		return err
	}

	// Forward any host errors directly to the client
	if msgType == message_types.Error {
		return clientConn.Send(createFileInitResp)
	}

	createFileInitRespDto, err := newHostStreamInitResponseDto(createFileInitResp)
	if err != nil {
		return err
	}

	// Notify client that upload can begin
	err = clientConn.Send(createFileInitResp)
	if err != nil {
		_ = clientConn.Send(message_types.CreateFileStreamEnd.Binary())
		return err
	}

	return s.handleUploadLoop(hostConn, clientConn, createFileInitRespDto.streamId)
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

		chunkReqDto, err := newMsgTypeWithPayloadDto(clientRequest)
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

func (s *defaultConnectionService) handleUploadLoop(
	hostConn hostconn.HostConn,
	clientConn clientconn.ClientConn,
	streamId uint32,
) (err error) {
	// Ensure the client is notified of stream termination on any error
	defer func() {
		if err != nil {
			_ = clientConn.Send(message_types.CreateFileStreamEnd.Binary())
		}
	}()

	for {
		// Query host for new chunk request
		hostResp, err := hostConn.Query(
			message_types.CreateFileHostChunkRequest.Binary(),
			helpers.Uint32ToBinary(streamId),
		)
		if err != nil {
			return err
		}

		hostChunkReqMsgType, err := message_types.GetMsgType(hostResp)
		if err != nil {
			return err
		}

		// Host signals completion or error - forward to client and exit
		if hostChunkReqMsgType == message_types.Error || hostChunkReqMsgType == message_types.CreateFileStreamEnd {
			return clientConn.Send(hostResp)
		}

		// Forward chunk request to the client
		err = clientConn.Send(hostResp)
		if err != nil {
			return err
		}

		// Wait for the client to send chunk data
		clientChunkResp, err := clientConn.Listen()
		if err != nil {
			return err
		}

		// Forward chunk data to host for processing
		hostChunkProcessingResp, err := hostConn.Query(clientChunkResp)
		if err != nil {
			return err
		}

		hostChunkProcessingRespMsgType, err := message_types.GetMsgType(hostChunkProcessingResp)
		if err != nil {
			return err
		}

		// Host signals completion or error after processing chunk
		if hostChunkProcessingRespMsgType == message_types.Error || hostChunkProcessingRespMsgType == message_types.CreateFileStreamEnd {
			return clientConn.Send(hostChunkProcessingResp)
		}

		// Host acknowledged chunk successfully - continue to next iteration
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
	chunkReqDto msgTypeWithPayload,
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

func (s *defaultConnectionService) queryHostResource(
	hostUuid uuid.UUID,
	resourceUuid uuid.UUID,
	path string,
	msgType message_types.WebsocketMessageType,
) ([]byte, error) {
	hostConn, ok := s.hostMap.Get(hostUuid)
	if !ok {
		return nil, ws_errors.HostNotFoundErr
	}

	resp, err := hostConn.Query(
		msgType.Binary(),
		helpers.UUIDToBinary(resourceUuid),
		[]byte(helpers.AddNullCharToString(path)),
	)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
