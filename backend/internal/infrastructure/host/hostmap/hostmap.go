package hostmap

import (
	"context"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/ws_errors"
	"log"
	"sync"

	"github.com/Basileus1990/EasyFileTransfer.git/internal/infrastructure/host/hostconn"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type HostMap interface {
	AddNew(ws *websocket.Conn) uuid.UUID
	Add(ws *websocket.Conn, id uuid.UUID) error
	Remove(id uuid.UUID)
	Get(id uuid.UUID) (hostconn.HostConn, bool)
}

// defaultHostMap provides thread-safe storage and management of host connections.
type defaultHostMap struct {
	hosts map[uuid.UUID]hostconn.HostConn
	mu    sync.RWMutex

	ctx             context.Context
	hostConnFactory hostconn.HostConnFactory
}

var _ HostMap = &defaultHostMap{}

func NewDefaultHostMap(ctx context.Context, hostConnFactory hostconn.HostConnFactory) HostMap {
	return &defaultHostMap{
		hosts:           make(map[uuid.UUID]hostconn.HostConn),
		ctx:             ctx,
		hostConnFactory: hostConnFactory,
	}
}

func (h *defaultHostMap) AddNew(ws *websocket.Conn) uuid.UUID {
	h.mu.Lock()
	defer h.mu.Unlock()

	var id uuid.UUID
	for {
		id = uuid.New()
		if _, ok := h.hosts[id]; !ok {
			break
		}
	}

	hostConn := h.hostConnFactory.NewHostConn(h.ctx, ws, func() {
		h.removeWithoutClosing(id)
	})
	h.hosts[id] = hostConn

	log.Printf("new host \"%v\" has connected\n", id)
	return id
}

func (h *defaultHostMap) Add(ws *websocket.Conn, id uuid.UUID) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.hosts[id]; ok {
		return ws_errors.HostAlreadyConnectedErr
	}

	hostConn := h.hostConnFactory.NewHostConn(h.ctx, ws, func() {
		h.removeWithoutClosing(id)
	})
	h.hosts[id] = hostConn

	log.Printf("host \"%v\" has reconnected\n", id)
	return nil
}

func (h *defaultHostMap) Remove(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if host, ok := h.hosts[id]; ok {
		host.Close()
	}
	delete(h.hosts, id)
	log.Printf("host \"%v\" has disconnected\n", id)
}

func (h *defaultHostMap) Get(id uuid.UUID) (hostconn.HostConn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	host, ok := h.hosts[id]
	return host, ok
}

func (h *defaultHostMap) removeWithoutClosing(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.hosts, id)
	log.Printf("host \"%v\" has disconnected\n", id)
}
